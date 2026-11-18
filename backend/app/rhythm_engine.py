"""Deterministic rhythm rules engine (BRD §8.4) — 10 s windows over beat labels + RR."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

RULE_VERSION = "rules-r1-20261118"
WINDOW_S = 10.0


@dataclass
class BeatEvent:
    time_s: float
    label: str
    confidence: float | None = None
    sample: int | None = None


@dataclass
class RhythmWindow:
    t0: float
    t1: float
    hr_bpm: float | None
    sqi: float
    findings: list[str] = field(default_factory=list)
    s_burden_pct: float = 0.0
    v_burden_pct: float = 0.0
    n_beats: int = 0
    rule_version: str = RULE_VERSION
    evidence: dict = field(default_factory=dict)


def _rr_intervals(beats: list[BeatEvent]) -> np.ndarray:
    if len(beats) < 2:
        return np.array([], dtype=float)
    times = np.array([b.time_s for b in beats], dtype=float)
    return np.diff(times)


def _hr_from_ns(beats: list[BeatEvent]) -> float | None:
    ns = [b for b in beats if b.label in ("N", "S")]
    if len(ns) < 2:
        return None
    rr = _rr_intervals(ns)
    rr = rr[(rr > 0.25) & (rr < 2.5)]
    if rr.size == 0:
        return None
    return float(60.0 / np.median(rr))


def _rmssd_nn(beats: list[BeatEvent]) -> float | None:
    nn = [b for b in beats if b.label == "N"]
    if len(nn) < 3:
        return None
    rr = _rr_intervals(nn)
    rr = rr[(rr > 0.3) & (rr < 2.0)]
    if rr.size < 2:
        return None
    diff = np.diff(rr)
    return float(np.sqrt(np.mean(diff**2)))


def _consecutive_runs(labels: list[str], target: str) -> list[int]:
    runs: list[int] = []
    n = 0
    for lab in labels:
        if lab == target:
            n += 1
        else:
            if n:
                runs.append(n)
            n = 0
    if n:
        runs.append(n)
    return runs


def _pattern_every_k(labels: list[str], target: str, k: int, min_cycles: int = 6) -> bool:
    if len(labels) < k * min_cycles:
        return False
    cycles = 0
    i = 0
    while i + k <= len(labels):
        window = labels[i : i + k]
        if window[-1] == target and all(x != target for x in window[:-1]):
            cycles += 1
            i += k
        else:
            cycles = 0
            i += 1
        if cycles >= min_cycles:
            return True
    return False


def evaluate_window(beats: list[BeatEvent], t1: float, window_s: float = WINDOW_S) -> RhythmWindow:
    t0 = max(0.0, t1 - window_s)
    win = [b for b in beats if t0 <= b.time_s <= t1]
    known = [b for b in win if b.label in ("N", "S", "V", "F")]
    unknown_n = sum(1 for b in win if b.label not in ("N", "S", "V", "F"))
    total = max(len(win), 1)
    sqi = max(0.0, min(1.0, 1.0 - (unknown_n / total) * 1.2))

    labels = [b.label for b in known]
    n_s = sum(1 for x in labels if x == "S")
    n_v = sum(1 for x in labels if x == "V")
    denom = max(len(labels), 1)
    s_burden = 100.0 * n_s / denom
    v_burden = 100.0 * n_v / denom

    hr = _hr_from_ns(known)
    findings: list[str] = []

    rr_all = _rr_intervals(known)
    pause_max = float(rr_all.max()) if rr_all.size else 0.0
    if pause_max > 3.0:
        findings.append("pause_critical")
    elif pause_max > 2.0:
        findings.append("pause")

    if hr is not None:
        if hr < 40:
            findings.append("bradycardia_severe")
        elif hr < 50:
            findings.append("bradycardia")
        elif hr > 150:
            findings.append("tachycardia_severe")
        elif hr > 100:
            findings.append("tachycardia")

    v_runs = _consecutive_runs(labels, "V")
    if any(r >= 3 for r in v_runs):
        # Sustained V pattern needs duration; approximate with run length * mean RR
        findings.append("v_run")
        if any(r >= 8 for r in v_runs):  # ~30s at ~120 bpm ≈ 60 beats; use shorter for 10s window demo
            findings.append("v_sustained_suspect")
    if any(r == 2 for r in v_runs):
        findings.append("v_couplet")

    s_runs = _consecutive_runs(labels, "S")
    if any(r >= 3 for r in s_runs) and hr is not None and hr > 100:
        findings.append("s_run")

    if _pattern_every_k(labels, "V", 2):
        findings.append("bigeminy")
    if _pattern_every_k(labels, "V", 3):
        findings.append("trigeminy")

    # Irregularity over available NN in window (proxy for 60s rule in short demos)
    rmssd = _rmssd_nn(known)
    mean_rr = None
    nn = [b for b in known if b.label == "N"]
    if len(nn) >= 3:
        rr = _rr_intervals(nn)
        rr = rr[(rr > 0.3) & (rr < 2.0)]
        if rr.size:
            mean_rr = float(np.mean(rr))
    if rmssd is not None and mean_rr and mean_rr > 0 and (rmssd / mean_rr) > 0.20:
        findings.append("irregular_rhythm_review")

    if s_burden >= 1.0:
        findings.append("s_burden_watch" if s_burden < 10 else "s_burden_high")
    if v_burden >= 1.0:
        findings.append("v_burden_watch" if v_burden <= 10 else "v_burden_high")

    if not findings and hr is not None and 50 <= hr <= 100 and v_burden < 1:
        findings.append("normal")

    return RhythmWindow(
        t0=t0,
        t1=t1,
        hr_bpm=hr,
        sqi=round(sqi, 3),
        findings=findings,
        s_burden_pct=round(s_burden, 2),
        v_burden_pct=round(v_burden, 2),
        n_beats=len(win),
        evidence={
            "pause_max_s": round(pause_max, 3),
            "rmssd": None if rmssd is None else round(rmssd, 4),
            "labels": labels[-40:],
        },
    )


def to_dict(window: RhythmWindow) -> dict:
    return {
        "t0": window.t0,
        "t1": window.t1,
        "hr_bpm": window.hr_bpm,
        "sqi": window.sqi,
        "findings": window.findings,
        "s_burden_pct": window.s_burden_pct,
        "v_burden_pct": window.v_burden_pct,
        "n_beats": window.n_beats,
        "rule_version": window.rule_version,
        "evidence": window.evidence,
    }
