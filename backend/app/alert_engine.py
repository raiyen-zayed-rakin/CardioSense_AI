"""Four-tier alerts with confirmation, dedupe, and cooldown (BRD §11)."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.risk_engine import RiskResult, TIER_ORDER
from app.rhythm_engine import RhythmWindow

RULE_VERSION = "alerts-r1-20261118"
COOLDOWN_S = 60.0

# Primary rule id chosen from findings (highest severity first)
FINDING_RULE: list[tuple[str, str, str]] = [
    ("pause_critical", "pause_gt_3s", "red"),
    ("bradycardia_severe", "hr_lt_40", "red"),
    ("tachycardia_severe", "hr_gt_150", "red"),
    ("v_sustained_suspect", "v_sustained", "red"),
    ("v_run", "v_run_nsvt", "orange"),
    ("pause", "pause_2_3s", "orange"),
    ("v_burden_high", "v_burden_gt_10", "orange"),
    ("irregular_rhythm_review", "irregular_rhythm", "amber"),
    ("v_couplet", "v_couplet", "amber"),
    ("bigeminy", "bigeminy", "amber"),
    ("trigeminy", "trigeminy", "amber"),
    ("s_run", "s_run", "amber"),
    ("bradycardia", "hr_40_50", "amber"),
    ("tachycardia", "hr_100_150", "amber"),
    ("v_burden_watch", "v_burden_1_10", "amber"),
    ("s_burden_high", "s_burden_high", "amber"),
    ("s_burden_watch", "s_burden_1_10", "amber"),
]


@dataclass
class AlertEvent:
    rule_id: str
    tier: str
    title: str
    message: str
    evidence: dict
    t: float


@dataclass
class AlertEngine:
    consecutive: dict[str, int] = field(default_factory=dict)
    last_fired: dict[str, float] = field(default_factory=dict)
    fired_rules: set[str] = field(default_factory=set)

    def _pick_rule(self, window: RhythmWindow, risk: RiskResult) -> tuple[str, str] | None:
        if window.sqi < 0.5:
            return None  # quality gate — no clinical alert
        fset = set(window.findings)
        for finding, rule_id, tier in FINDING_RULE:
            if finding not in fset:
                continue
            # S-only never above amber
            if tier in ("orange", "red") and finding.startswith("s_"):
                tier = "amber"
            # Align with risk tier cap
            if TIER_ORDER.index(tier) > TIER_ORDER.index(risk.tier):
                tier = risk.tier
            if tier == "green":
                return None
            return rule_id, tier
        return None

    def evaluate(self, window: RhythmWindow, risk: RiskResult) -> AlertEvent | None:
        picked = self._pick_rule(window, risk)
        if not picked:
            # reset mild consecutive trackers when quiet
            self.consecutive = {k: 0 for k in self.consecutive}
            return None

        rule_id, tier = picked
        immediate = rule_id == "pause_gt_3s"
        need_confirm = tier in ("orange", "red") and not immediate

        count = self.consecutive.get(rule_id, 0) + 1
        self.consecutive[rule_id] = count
        # decay others
        for k in list(self.consecutive):
            if k != rule_id:
                self.consecutive[k] = 0

        if need_confirm and count < 2:
            return None

        last = self.last_fired.get(rule_id)
        if last is not None and (window.t1 - last) < COOLDOWN_S:
            return None

        self.last_fired[rule_id] = window.t1
        self.fired_rules.add(rule_id)

        title = {
            "amber": "Watch",
            "orange": "Urgent",
            "red": "Critical",
        }.get(tier, tier.title())

        msg = risk.factors[0] if risk.factors else f"Rule {rule_id} triggered"
        return AlertEvent(
            rule_id=rule_id,
            tier=tier,
            title=f"{title}: {rule_id.replace('_', ' ')}",
            message=msg,
            evidence={
                "rule_version": RULE_VERSION,
                "window": {
                    "t0": window.t0,
                    "t1": window.t1,
                    "hr_bpm": window.hr_bpm,
                    "sqi": window.sqi,
                    "findings": window.findings,
                    "s_burden_pct": window.s_burden_pct,
                    "v_burden_pct": window.v_burden_pct,
                },
                "risk": {"score": risk.score, "band": risk.band, "tier": risk.tier},
                "factors": risk.factors,
            },
            t=window.t1,
        )


def alert_to_dict(alert: AlertEvent) -> dict:
    return {
        "rule_id": alert.rule_id,
        "tier": alert.tier,
        "title": alert.title,
        "message": alert.message,
        "t": alert.t,
        "evidence": alert.evidence,
    }
