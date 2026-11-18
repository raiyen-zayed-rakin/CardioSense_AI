"""Dr. Aime — product guide + BRD-bounded clinical documentation assistant."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings

# Ground truth for what the MVP UI actually ships — never invent controls.
PRODUCT_FACTS = """
Product facts (use only these; do not invent UI):

Global:
- Auth: login / register for clinician console; or Continue as guest → /home (no account).
- Patients list (signed-in): create patient (name, MRN, age, notes, consent), open monitor.
- Home (/home): guest live ECG console (replay today; AD8232 later) with rhythm, risk, alerts, Dr. Aime.
- Account: profile for the signed-in clinician.
- No pause-step timeline scrubber. No left-side MRN patient picker on the monitor.

Monitor page (/monitor/[id]?record=...):
- Controls (top card): MIT-BIH record dropdown (100/119/208/200/233), Speed (0.5/1/2/4×; chosen before start),
  Ground truth checkbox, Start replay, Stop (ends the live WebSocket stream).
- There is NO Pause button and NO step forward/back in this MVP.
- ECG strip: scrolling waveform from MIT-BIH replay with model beat markers overlaid.
- Beat ribbon: recent ~72 model labels color-coded N/S/V/F under the strip.
- Rhythm status: 10 s rules-engine window (HR, SQI, findings, S/V burden).
- Risk gauge: 0–100 score, green/amber/orange/red band, plain-language factors.
- Alerts: in-app tiered alerts with confirmation/dedupe/cooldown (no email yet).
- Model labels card: running counts of predicted N/S/V/F/Unknown.
- Ground truth card: cardiologist annotation counts (toggle via Ground truth checkbox).
- Latest beats card: newest predicted beats with time, label, confidence %.
- Status text shows Idle / preparing / streaming / finished / stopped.
- Demo only — decision support, not a diagnosis.

Beat labels: N normal/BBB-class, S supraventricular ectopic, V ventricular ectopic, F fusion.
"""

SYSTEM_PROMPT = f"""You are Dr. Aime, the in-app guide for CardioSense AI (research demo, not a medical device).

Role:
- Help clinicians use this MVP using PRODUCT FACTS only.
- When discussing rhythm or beats, stay in decision-support language only.

{PRODUCT_FACTS}

Style (compact but clear):
- Target 40–70 words. Hard cap 90 words.
- Lead with the useful answer in the first sentence.
- Use short bullets only when listing labels or sections (max 4).
- Skip filler and closing offers like "Let me know if you…".
- Always end on a complete sentence — never mid-phrase.
- If asked about a control that does not exist (e.g. Pause), say it is not in this MVP and name what does exist (Start replay / Stop / Speed / record).

Hard rules (BRD):
- Do NOT diagnose, prescribe, or give emergency instructions.
- Do NOT invent UI features, buttons, or patient history.
- If patient-event evidence is not supplied, stay on product guidance.
- Never claim to be a licensed physician making treatment decisions.

Tone: calm, clear, clinical UI guide."""

FAQ_ITEMS: list[dict[str, str]] = [
    {
        "id": "start-monitor",
        "label": "How do I start a live monitor?",
        "answer": (
            "On Patients, open a patient and Start monitor (or open /monitor/[id]). "
            "Pick a MIT-BIH record and speed, then press Start replay. "
            "Use Stop to end the stream. There is no Pause in this MVP."
        ),
    },
    {
        "id": "ecg-strip",
        "label": "What is the ECG strip?",
        "answer": (
            "The ECG strip is the live scrolling waveform from the MIT-BIH replay. "
            "Model beat markers appear on the trace. Under it, the beat ribbon shows recent N/S/V/F labels. "
            "It is demo decision support, not a diagnosis."
        ),
    },
    {
        "id": "monitor-sections",
        "label": "What do the monitor sections mean?",
        "answer": (
            "ECG strip + beat ribbon = waveform and recent labels. "
            "Rhythm status = 10 s rules (HR, SQI, findings). Risk gauge = 0–100 score and band. "
            "Alerts = in-app tiered notifications. Model labels / ground truth / latest beats are the count panels."
        ),
    },
    {
        "id": "pause-stop",
        "label": "Can I pause replay?",
        "answer": (
            "This MVP has Start replay and Stop (ends the WebSocket stream), plus speed set before start. "
            "There is no Pause or step forward/back yet."
        ),
    },
    {
        "id": "beat-labels",
        "label": "What do the beat labels mean?",
        "answer": (
            "AAMI-style classes from the CardioSense model: "
            "N = normal/bundle-branch, S = supraventricular ectopic, V = ventricular ectopic, "
            "F = fusion. Decision support only — not a diagnosis."
        ),
    },
    {
        "id": "add-patient",
        "label": "How do I add a patient?",
        "answer": (
            "On Patients, use Add patient. Enter name, MRN, optional age/notes, and confirm consent. "
            "Stored via POST /v1/patients for your account."
        ),
    },
    {
        "id": "what-is-mrn",
        "label": "What is an MRN?",
        "answer": (
            "MRN is the Medical Record Number — a unique chart ID. "
            "In this demo, values like DEMO-100 map replay to MIT-BIH record 100."
        ),
    },
    {
        "id": "cannot-do",
        "label": "What can't Dr. Aime do?",
        "answer": (
            "I cannot diagnose, prescribe, or give emergency instructions, and I must not invent UI features. "
            "I explain the CardioSense screens that exist in this MVP. Research decision support only."
        ),
    },
]

MONITOR_SUGGESTION_IDS = [
    "ecg-strip",
    "monitor-sections",
    "pause-stop",
    "beat-labels",
    "cannot-do",
]

DEFAULT_SUGGESTION_IDS = [
    "start-monitor",
    "beat-labels",
    "add-patient",
    "what-is-mrn",
    "cannot-do",
]


def _faq_by_id(faq_id: str) -> dict[str, str] | None:
    for item in FAQ_ITEMS:
        if item["id"] == faq_id:
            return item
    return None


def page_context(page: str | None) -> str:
    path = (page or "").lower()
    if path.startswith("/home"):
        return (
            "User is on Home monitoring (guest, no account). "
            "Same live console as monitor: ECG strip, rhythm, risk, alerts, Start/Stop replay. "
            "Sensor pairing is not available yet — replay only. Do not invent Pause."
        )
    if path.startswith("/monitor"):
        return (
            "User is on the Live MIT-BIH Replay Monitor. "
            "Explain ECG strip, beat ribbon, model labels, ground truth, latest beats, "
            "Start replay / Stop / record / speed. Do not mention Pause or scrubbing."
        )
    if path.startswith("/patients"):
        return "User is on Patients: list, add patient, open monitor for a selected patient."
    if path.startswith("/account"):
        return "User is on Account: signed-in clinician profile."
    return "User page unknown; stick to PRODUCT FACTS."


def suggestions(page: str | None = None) -> list[dict[str, str]]:
    ids = MONITOR_SUGGESTION_IDS if (page or "").lower().startswith("/monitor") else DEFAULT_SUGGESTION_IDS
    out: list[dict[str, str]] = []
    for faq_id in ids:
        item = _faq_by_id(faq_id)
        if item:
            out.append({"id": item["id"], "label": item["label"]})
    return out


def faq_fallback(message: str, page: str | None = None) -> str | None:
    text = message.lower().strip()
    # Exact chip match first (any page)
    for item in FAQ_ITEMS:
        if item["label"].lower() == text:
            return item["answer"]

    # Specific rules before broad ones
    rules: list[tuple[str, list[str]]] = [
        ("pause-stop", ["pause", "stop button", "step forward", "step back", "scrub"]),
        ("ecg-strip", ["ecg strip", "waveform", "scrolling", "trace"]),
        (
            "monitor-sections",
            [
                "monitor section",
                "sections",
                "beat ribbon",
                "model labels",
                "ground truth",
                "latest beats",
                "what do the",
                "cards mean",
            ],
        ),
        ("beat-labels", ["beat label", "n/s/v", "aami", "ventricular", "supraventricular", "fusion beat"]),
        ("add-patient", ["add patient", "create patient", "new patient"]),
        ("what-is-mrn", ["what is an mrn", "what is mrn", "medical record number"]),
        ("cannot-do", ["can't you", "cannot you", "what can't", "diagnose", "prescribe", "emergency"]),
        ("start-monitor", ["start a live", "start monitor", "start replay", "how do i start"]),
    ]
    for faq_id, keys in rules:
        if any(k in text for k in keys):
            item = _faq_by_id(faq_id)
            if item:
                return item["answer"]

    # On monitor, soft default for vague "what is this" questions
    if (page or "").lower().startswith("/monitor") and any(
        k in text for k in ("this page", "this screen", "what am i looking", "explain this")
    ):
        item = _faq_by_id("monitor-sections")
        if item:
            return item["answer"]
    return None


def default_fallback() -> str:
    return (
        "I can explain Patients, Start/Stop MIT-BIH replay, the ECG strip, beat ribbon, "
        "model vs ground-truth counts, and N/S/V/F labels. I do not diagnose or invent missing controls."
    )


def build_messages(
    user_message: str,
    history: list[dict[str, str]] | None = None,
    page: str | None = None,
) -> list[dict[str, str]]:
    context = f"Current UI page: {page or 'unknown'}\n{page_context(page)}"
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT + "\n" + context}]
    for turn in (history or [])[-8:]:
        role = turn.get("role")
        content = (turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:2000]})
    messages.append({"role": "user", "content": user_message.strip()[:4000]})
    return messages


async def stream_groq(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY not configured")

    url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": 0.25,
        # gpt-oss uses reasoning tokens against this budget; keep headroom so replies finish.
        "max_tokens": 1024,
        "stream": True,
    }
    if "gpt-oss" in settings.groq_model:
        payload["reasoning_effort"] = "low"

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise RuntimeError(f"Groq error {resp.status_code}: {body.decode()[:400]}")
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content")
                if text:
                    yield text


_DIAG_RE = re.compile(
    r"\b(you have|diagnos(?:e|is|ed)|prescrib(?:e|ing)|take \d+ ?mg|call 911|go to (?:the )?er)\b",
    re.I,
)


def safety_trim(text: str) -> str:
    cleaned = text.strip()
    if _DIAG_RE.search(cleaned):
        return (
            "I can't provide diagnoses, prescriptions, or emergency instructions. "
            "Please review the monitoring console and escalate through your clinical workflow. "
            "I can still help with how to use CardioSense."
        )
    cleaned = re.sub(
        r"(?:Let me know if you|Feel free to ask(?: me)?(?: if)?|If you (?:need|want|have)|Would you like me to).*$",
        "",
        cleaned,
        flags=re.I,
    ).rstrip(" ,;:-")
    words = cleaned.split()
    if len(words) > 95:
        clipped = " ".join(words[:90]).rstrip(" ,;:-")
        for end in (". ", "! ", "? ", ".\n", "!\n", "?\n"):
            idx = clipped.rfind(end)
            if idx >= 24:
                return clipped[: idx + 1].strip()
        if re.search(r"[.!?]$", clipped):
            return clipped
        return clipped + "."
    if cleaned and not re.search(r"[.!?]$", cleaned):
        cleaned += "."
    return cleaned
