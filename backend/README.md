# CardioSense backend env

Python **3.12** venv for FastAPI + beat-model inference. App scaffold comes next.

## Activate (PowerShell)

```powershell
cd "d:\Hackations\ai congress\base-test-v1\MAIN_MVP\backend"
.\.venv\Scripts\Activate.ps1
```

## Verify

```powershell
python verify_env.py
```

Expect `VERIFY_OK` and `pth vs ts max diff` near `0`.

## Notes

- Model files live in `../cardiosense_beat_model/` (copied into `MAIN_MVP`).
- Pip cache is in `.pip-cache/` on D: to avoid filling C:.
- Torch is the **CPU** build (`torch…+cpu`).
