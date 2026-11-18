"""Smoke-check: imports + load beat_model.pth / TorchScript. Run from backend/ with venv active."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT.parent / "cardiosense_beat_model"
sys.path.insert(0, str(MODEL_DIR))


def main() -> None:
    print("python:", sys.version.split()[0])
    print("model_dir:", MODEL_DIR, "exists=", MODEL_DIR.is_dir())

    import fastapi, uvicorn, pydantic, sqlalchemy, jwt, argon2, numpy, scipy, torch, wfdb
    import cardiosense_beats as cb

    print("fastapi", fastapi.__version__)
    print("torch", torch.__version__, "cuda=", torch.cuda.is_available())
    print("numpy", numpy.__version__, "scipy", scipy.__version__, "wfdb", wfdb.__version__)

    pth = MODEL_DIR / "beat_model.pth"
    ts = MODEL_DIR / "beat_model_ts.pt"
    cfg = MODEL_DIR / "model_config.json"
    assert pth.is_file() and ts.is_file() and cfg.is_file()

    model = cb.load_state_dict_model(str(pth), n_models=3, device="cpu")
    ts_model = torch.jit.load(str(ts), map_location="cpu")
    x = torch.randn(4, 2, 250)
    rr = torch.randn(4, 7)
    with torch.no_grad():
        p = model(x, rr)
        t = ts_model(x, rr)
    diff = (p - t).abs().max().item()
    print("pth shape:", tuple(p.shape), "row_sum:", p.sum(1).tolist())
    print("pth vs ts max diff:", diff)
    assert p.shape == (4, 4)
    assert diff < 1e-5

    clf = cb.BeatClassifier(str(pth), str(cfg), device="cpu")
    # ~8 s of synthetic 250 Hz noise (not real ECG; just pipeline wiring)
    fake = numpy.random.randn(250 * 8).astype(numpy.float64) * 0.01
    beats = clf.classify(fake, 250)
    print("classify(fake) returned", len(beats), "beats (may be 0 on noise — OK)")
    print("VERIFY_OK")


if __name__ == "__main__":
    main()
