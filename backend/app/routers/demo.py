import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal, get_db
from app.ml_service import inference
from app.models import Patient, Session, User
from app.replay import get_replay, load_replay_signal, prepare_beats, register_session, subscribe, unsubscribe
from app.schemas import ReplayStartIn, ReplayStartOut
from app.security import decode_token, get_current_user

router = APIRouter(tags=["demo"])


@router.post("/demo/replay", response_model=ReplayStartOut)
async def start_replay(
    body: ReplayStartIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await db.get(Patient, body.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.consent:
        raise HTTPException(status_code=400, detail="Consent required")

    try:
        samples, fs, gt = await asyncio.to_thread(load_replay_signal, body.record, 180.0)
        beats = await asyncio.to_thread(prepare_beats, samples, fs)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Replay prepare failed: {exc}") from exc

    session = Session(
        patient_id=patient.id,
        source="replay",
        record_id=body.record,
        status="ready",
        model_version=inference.state.version,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    register_session(session.id, patient.id, body.record, body.speed, samples, fs, beats, gt)

    return ReplayStartOut(
        session_id=session.id,
        record=body.record,
        fs=fs,
        n_samples=int(samples.size),
        duration_s=float(samples.size / fs),
        ws_path=f"/v1/stream/{session.id}",
    )


@router.websocket("/stream/{session_id}")
async def stream_ws(websocket: WebSocket, session_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = decode_token(token, "access")
        user_id = int(payload["sub"])
    except Exception:  # noqa: BLE001
        await websocket.close(code=4401)
        return

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        if user is None or not user.is_active:
            await websocket.close(code=4401)
            return

    rs = get_replay(session_id)
    if rs is None:
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Unknown session — start replay first"})
        await websocket.close()
        return

    await websocket.accept()
    q = subscribe(session_id)
    try:
        while True:
            msg = await q.get()
            await websocket.send_json(msg)
            if msg.get("type") == "done":
                break
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe(session_id, q)
