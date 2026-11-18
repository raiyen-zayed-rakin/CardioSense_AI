from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

import numpy as np

from app.config import settings
from app.ml_service import inference
from app.session_intel import SessionIntel, _persist_async


@dataclass
class ReplaySession:
    session_id: int
    patient_id: int
    record: str
    speed: float
    fs: int
    samples: np.ndarray
    beats: list[dict]
    ground_truth: list[dict] = field(default_factory=list)
    subscribers: set[asyncio.Queue] = field(default_factory=set)
    task: asyncio.Task | None = None
    playing: bool = False
    cursor: int = 0
    intel: SessionIntel | None = None


_sessions: dict[int, ReplaySession] = {}


def get_replay(session_id: int) -> ReplaySession | None:
    return _sessions.get(session_id)


def ensure_mitdb_record(record: str) -> None:
    settings.mitdb_dir.mkdir(parents=True, exist_ok=True)
    dat = settings.mitdb_dir / f"{record}.dat"
    if dat.exists():
        return
    import wfdb

    wfdb.dl_database("mitdb", dl_dir=str(settings.mitdb_dir), records=[record])


def load_replay_signal(record: str, max_seconds: float = 180.0) -> tuple[np.ndarray, int, list[dict]]:
    """Load MIT-BIH lead, resample+filter to 250 Hz, return samples and optional GT labels."""
    import sys

    import wfdb

    ensure_mitdb_record(record)
    path = settings.mitdb_dir / record
    rec = wfdb.rdrecord(str(path))
    # Prefer MLII if present
    lead_idx = 0
    if rec.sig_name:
        for i, name in enumerate(rec.sig_name):
            if "MLII" in name.upper() or name.upper() == "II":
                lead_idx = i
                break
    raw = rec.p_signal[:, lead_idx]
    fs_in = float(rec.fs)
    n = int(min(len(raw), max_seconds * fs_in))
    raw = raw[:n]

    sys.path.insert(0, str(settings.model_dir))
    import cardiosense_beats as cb

    x = cb.preprocess(raw, fs_in, fs_out=250)
    fs = 250

    # Ground-truth beat labels (AAMI map), times at 250 Hz
    gt: list[dict] = []
    try:
        ann = wfdb.rdann(str(path), "atr")
        aami = {
            "N": "N", "L": "N", "R": "N", "e": "N", "j": "N",
            "A": "S", "a": "S", "J": "S", "S": "S",
            "V": "V", "E": "V",
            "F": "F",
        }
        scale = fs / fs_in
        for sample, symbol in zip(ann.sample, ann.symbol):
            if sample >= n:
                break
            label = aami.get(symbol)
            if label is None:
                continue
            gt.append({"sample": int(sample * scale), "time_s": float(sample * scale / fs), "label": label})
    except Exception:  # noqa: BLE001
        gt = []

    return x.astype(np.float32), fs, gt


def prepare_beats(samples: np.ndarray, fs: int) -> list[dict]:
    if not inference.ready:
        inference.load()
    return inference.classify_chunk(samples, fs)


async def start_replay_broadcast(session: ReplaySession) -> None:
    if session.playing:
        return
    session.playing = True
    session.cursor = 0
    frame_samples = max(1, session.fs // 10)  # 100 ms
    interval = (frame_samples / session.fs) / max(session.speed, 0.01)

    # index beats by sample for emission
    beat_i = 0
    gt_i = 0

    async def emit(msg: dict) -> None:
        dead: list[asyncio.Queue] = []
        for q in session.subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            session.subscribers.discard(q)

    await emit({"type": "meta", "record": session.record, "fs": session.fs,
                "n_samples": int(session.samples.size), "demo": True,
                "model_version": inference.state.version})

    try:
        while session.playing and session.cursor < len(session.samples):
            end = min(session.cursor + frame_samples, len(session.samples))
            chunk = session.samples[session.cursor:end]
            t0 = session.cursor / session.fs
            await emit({
                "type": "frame",
                "seq": session.cursor,
                "t0": t0,
                "fs": session.fs,
                "samples": chunk.tolist(),
                "source": "replay",
                "lead_off": False,
            })

            while beat_i < len(session.beats) and session.beats[beat_i]["sample"] < end:
                beat = session.beats[beat_i]
                await emit({"type": "beat", "beat": beat})
                if session.intel:
                    session.intel.add_beat(beat)
                beat_i += 1
            while gt_i < len(session.ground_truth) and session.ground_truth[gt_i]["sample"] < end:
                await emit({"type": "gt", "beat": session.ground_truth[gt_i]})
                gt_i += 1

            t_now = end / session.fs
            if session.intel:
                for msg in session.intel.poll(t_now):
                    persist = msg.pop("persist", None)
                    await emit(msg)
                    if persist:
                        asyncio.create_task(_persist_async(persist))

            session.cursor = end
            await asyncio.sleep(interval)

        await emit({"type": "done", "session_id": session.session_id})
    finally:
        session.playing = False


def register_session(
    session_id: int,
    patient_id: int,
    record: str,
    speed: float,
    samples: np.ndarray,
    fs: int,
    beats: list[dict],
    ground_truth: list[dict],
) -> ReplaySession:
    old = _sessions.pop(session_id, None)
    if old and old.task and not old.task.done():
        old.playing = False
        old.task.cancel()
    rs = ReplaySession(
        session_id=session_id,
        patient_id=patient_id,
        record=record,
        speed=speed,
        fs=fs,
        samples=samples,
        beats=beats,
        ground_truth=ground_truth,
        intel=SessionIntel(session_id=session_id, patient_id=patient_id),
    )
    _sessions[session_id] = rs
    return rs


def subscribe(session_id: int) -> asyncio.Queue:
    rs = _sessions[session_id]
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    rs.subscribers.add(q)
    if not rs.playing:
        rs.task = asyncio.create_task(start_replay_broadcast(rs))
    return q


def unsubscribe(session_id: int, q: asyncio.Queue) -> None:
    rs = _sessions.get(session_id)
    if rs:
        rs.subscribers.discard(q)
