"""Per-session rhythm → risk → alert pipeline driven by streamed beats."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.alert_engine import AlertEngine, alert_to_dict
from app.risk_engine import score_window, to_dict as risk_to_dict
from app.rhythm_engine import BeatEvent, WINDOW_S, evaluate_window, to_dict as rhythm_to_dict


@dataclass
class SessionIntel:
    session_id: int
    patient_id: int
    beats: list[BeatEvent] = field(default_factory=list)
    next_window_t: float = WINDOW_S
    alerts: AlertEngine = field(default_factory=AlertEngine)
    latest_risk_band: str = "green"
    latest_risk_score: int = 0
    windows_emitted: int = 0

    def add_beat(self, beat: dict) -> None:
        self.beats.append(
            BeatEvent(
                time_s=float(beat["time_s"]),
                label=str(beat.get("label") or "Unknown"),
                confidence=beat.get("confidence"),
                sample=beat.get("sample"),
            )
        )

    def poll(self, t_now: float) -> list[dict]:
        """Emit zero or more WS payloads (rhythm / risk / alert) up to t_now."""
        out: list[dict] = []
        while t_now + 1e-6 >= self.next_window_t:
            t1 = self.next_window_t
            window = evaluate_window(self.beats, t1=t1)
            risk = score_window(window)
            self.latest_risk_band = risk.band
            self.latest_risk_score = risk.score
            self.windows_emitted += 1

            out.append({"type": "rhythm", "window": rhythm_to_dict(window)})
            out.append({"type": "risk", "risk": risk_to_dict(risk)})

            alert = self.alerts.evaluate(window, risk)
            if alert:
                out.append(
                    {
                        "type": "alert",
                        "alert": alert_to_dict(alert),
                        "persist": {
                            "session_id": self.session_id,
                            "patient_id": self.patient_id,
                            "window": rhythm_to_dict(window),
                            "risk": risk_to_dict(risk),
                            "alert": alert_to_dict(alert),
                        },
                    }
                )
            else:
                out.append(
                    {
                        "type": "persist_window",
                        "persist": {
                            "session_id": self.session_id,
                            "patient_id": self.patient_id,
                            "window": rhythm_to_dict(window),
                            "risk": risk_to_dict(risk),
                            "alert": None,
                        },
                    }
                )

            self.next_window_t += WINDOW_S
        return out


async def _persist_async(payload: dict) -> None:
    from app.db import SessionLocal
    from app.models import AlertRow, Patient, RhythmWindowRow

    window = payload["window"]
    risk = payload["risk"]
    alert = payload.get("alert")
    async with SessionLocal() as db:
        row = RhythmWindowRow(
            session_id=payload["session_id"],
            patient_id=payload["patient_id"],
            t0=window["t0"],
            t1=window["t1"],
            hr_bpm=window.get("hr_bpm"),
            sqi=window.get("sqi") or 0,
            findings_json=json.dumps(window.get("findings") or []),
            s_burden_pct=window.get("s_burden_pct") or 0,
            v_burden_pct=window.get("v_burden_pct") or 0,
            risk_score=risk.get("score") or 0,
            risk_band=risk.get("band") or "green",
            rule_version=window.get("rule_version") or "",
        )
        db.add(row)

        band = risk.get("band") or "green"
        order = ["green", "amber", "orange", "red"]
        patient = await db.get(Patient, payload["patient_id"])
        if patient is not None:
            cur = patient.risk_band or "green"
            if order.index(band) >= order.index(cur if cur in order else "green"):
                patient.risk_band = band

        if alert:
            db.add(
                AlertRow(
                    session_id=payload["session_id"],
                    patient_id=payload["patient_id"],
                    rule_id=alert["rule_id"],
                    tier=alert["tier"],
                    title=alert["title"],
                    message=alert["message"],
                    evidence_json=json.dumps(alert.get("evidence") or {}),
                    t=alert.get("t") or window["t1"],
                    status="open",
                )
            )
        await db.commit()
