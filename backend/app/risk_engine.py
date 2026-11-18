"""0–100 risk score + plain-language factors from rhythm findings (BRD FR-12 / §11)."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.rhythm_engine import RhythmWindow

# Finding → (tier weight points, plain factor). Higher wins for band.
FINDING_POINTS: dict[str, tuple[int, str]] = {
    "normal": (5, "Rhythm within routine rate band"),
    "s_burden_watch": (28, "Elevated S ectopy burden"),
    "s_burden_high": (35, "High S ectopy burden"),
    "v_burden_watch": (32, "Elevated V ectopy burden"),
    "v_burden_high": (58, "High V ectopy burden (>10%)"),
    "v_couplet": (36, "Ventricular couplet detected"),
    "bigeminy": (38, "Ventricular bigeminy pattern"),
    "trigeminy": (36, "Ventricular trigeminy pattern"),
    "s_run": (34, "Supraventricular run at elevated rate"),
    "irregular_rhythm_review": (40, "Irregular rhythm — review (not an AFib diagnosis)"),
    "bradycardia": (35, "Heart rate 40–50 bpm"),
    "tachycardia": (35, "Heart rate 100–150 bpm"),
    "pause": (55, "Pause 2–3 s"),
    "v_run": (62, "Non-sustained ventricular run (≥3)"),
    "bradycardia_severe": (82, "Heart rate < 40 bpm"),
    "tachycardia_severe": (85, "Heart rate > 150 bpm"),
    "pause_critical": (90, "Pause > 3 s"),
    "v_sustained_suspect": (88, "Sustained ventricular pattern suspected"),
}

TIER_ORDER = ["green", "amber", "orange", "red"]


def band_from_score(score: int) -> str:
    if score >= 75:
        return "red"
    if score >= 50:
        return "orange"
    if score >= 25:
        return "amber"
    return "green"


def tier_from_findings(findings: list[str]) -> str:
    """Map findings to BRD alert tier (before confirmation rules)."""
    fset = set(findings)
    if fset & {"bradycardia_severe", "tachycardia_severe", "pause_critical", "v_sustained_suspect"}:
        return "red"
    if fset & {"v_run", "pause", "v_burden_high"}:
        return "orange"
    if fset & {
        "s_burden_watch",
        "s_burden_high",
        "v_burden_watch",
        "v_couplet",
        "bigeminy",
        "trigeminy",
        "s_run",
        "bradycardia",
        "tachycardia",
        "irregular_rhythm_review",
    }:
        return "amber"
    return "green"


@dataclass
class RiskResult:
    score: int
    band: str
    factors: list[str] = field(default_factory=list)
    tier: str = "green"


def score_window(window: RhythmWindow) -> RiskResult:
    # Low SQI: do not inflate clinical risk; surface quality as a factor only.
    if window.sqi < 0.5:
        return RiskResult(
            score=20,
            band="amber",
            factors=["Low signal quality — clinical alerts gated"],
            tier="green",  # gated: no clinical escalation from this window alone
        )

    points = 10
    factors: list[str] = []
    for finding in window.findings:
        if finding == "normal":
            continue
        pair = FINDING_POINTS.get(finding)
        if not pair:
            continue
        pts, text = pair
        points = max(points, pts)
        factors.append(text)

    if window.hr_bpm is not None:
        factors.insert(0, f"Window HR ≈ {window.hr_bpm:.0f} bpm")
    factors.append(f"V burden {window.v_burden_pct:.1f}% · S burden {window.s_burden_pct:.1f}%")

    # Cap S-only escalations at amber per BRD
    tier = tier_from_findings(window.findings)
    only_s = all(
        f.startswith("s_") or f in ("normal", "irregular_rhythm_review", "bradycardia", "tachycardia")
        for f in window.findings
        if f != "normal"
    ) and any(f.startswith("s_") for f in window.findings)
    if only_s and tier in ("orange", "red"):
        tier = "amber"
        points = min(points, 45)

    score = int(max(0, min(100, points)))
    band = band_from_score(score)
    # Align band with clinical tier when tier is higher
    if TIER_ORDER.index(tier) > TIER_ORDER.index(band):
        band = tier
        score = max(score, {"green": 15, "amber": 35, "orange": 60, "red": 85}[tier])

    return RiskResult(score=score, band=band, factors=factors[:6], tier=tier)


def to_dict(risk: RiskResult) -> dict:
    return {
        "score": risk.score,
        "band": risk.band,
        "tier": risk.tier,
        "factors": risk.factors,
    }
