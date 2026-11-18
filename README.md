# CardioSense AI — MAIN MVP

M1 slice: **custom FastAPI auth**, patient list, **MIT-BIH replay**, live ECG console with beat labels from our model.

```text
MAIN_MVP/
  cardiosense_beat_model/   # weights + cardiosense_beats.py
  backend/                  # FastAPI + venv
  web/                      # Next.js console
```

## Prerequisites

- Python 3.12 venv already at `backend/.venv`
- Node.js 18+
- Internet once (to download MIT-BIH record on first replay)

## 1. Start API

```powershell
cd "d:\Hackations\ai congress\base-test-v1\MAIN_MVP\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check: http://127.0.0.1:8000/health

## 2. Start web

```powershell
cd "d:\Hackations\ai congress\base-test-v1\MAIN_MVP\web"
npm run dev
```

Open: http://localhost:3000

## Demo login

| Field | Value |
|---|---|
| Email | `clinician@example.com` |
| Password | `demo1234` |

Or use **Register** at `/register`, then **New patient** on the patients page.

Then open a patient console → pick MIT-BIH record → **Start replay**.

First run for a record may take ~10–30 s (download + classify ~3 minutes of ECG).

### Frontend ↔ backend coverage

| Backend | UI |
|---|---|
| `POST /v1/auth/register` | `/register` |
| `POST /v1/auth/login` | `/login` |
| `POST /v1/auth/refresh` | automatic on 401 |
| `GET /v1/auth/me` | `/account` |
| `GET /health` | `/account` + header badge |
| `GET/POST /v1/patients` | `/patients` + New patient |
| `GET /v1/patients/{id}` | `/patients/[id]` |
| `POST /v1/demo/replay` + WS stream | `/monitor/[id]` |

## Notes

- Auth: JWT access + refresh, Argon2id passwords (custom FastAPI)
- DB: SQLite at `backend/data/cardiosense.db`
- Model: TorchScript `beat_model_ts.pt` on CPU
- Hardware serial source: not wired yet (replay only)
