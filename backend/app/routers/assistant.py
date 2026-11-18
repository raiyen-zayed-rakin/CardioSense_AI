from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import assistant_service as aide
from app.models import User
from app.security import get_current_user

router = APIRouter(prefix="/assistant", tags=["assistant"])


class SuggestionOut(BaseModel):
    id: str
    label: str


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    page: str | None = None
    history: list[ChatTurn] = Field(default_factory=list)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/suggestions", response_model=list[SuggestionOut])
async def get_suggestions(
    page: str | None = Query(default=None),
    _: User = Depends(get_current_user),
):
    return aide.suggestions(page)


@router.post("/chat")
async def chat(body: ChatIn, _: User = Depends(get_current_user)):
    message = body.message.strip()

    async def events() -> AsyncIterator[bytes]:
        history = [{"role": t.role, "content": t.content} for t in body.history]
        faq = aide.faq_fallback(message, page=body.page)
        chip_exact = any(
            s["label"].lower() == message.lower() for s in aide.suggestions(body.page)
        ) or any(item["label"].lower() == message.lower() for item in aide.FAQ_ITEMS)

        if chip_exact and faq:
            yield _sse({"type": "token", "text": faq}).encode()
            yield _sse({"type": "done", "source": "faq"}).encode()
            return

        try:
            messages = aide.build_messages(message, history=history, page=body.page)
            buffer: list[str] = []
            async for token in aide.stream_groq(messages):
                buffer.append(token)
                yield _sse({"type": "token", "text": token}).encode()
            full = aide.safety_trim("".join(buffer))
            joined = "".join(buffer).strip()
            if full != joined:
                yield _sse({"type": "replace", "text": full}).encode()
            yield _sse({"type": "done", "source": "groq"}).encode()
        except Exception as exc:  # noqa: BLE001
            print("Dr. Aime Groq fallback:", exc)
            fallback = faq or aide.default_fallback()
            yield _sse({"type": "token", "text": fallback}).encode()
            yield _sse({"type": "done", "source": "fallback"}).encode()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
