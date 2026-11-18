from __future__ import annotations

import sys
from dataclasses import dataclass
from threading import Lock

import numpy as np

from app.config import settings


@dataclass
class MLState:
    ready: bool = False
    version: str | None = None
    error: str | None = None


class BeatInference:
    """Lazy-loaded beat classifier shared across the process."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._clf = None
        self.state = MLState()

    def load(self) -> None:
        with self._lock:
            if self._clf is not None:
                return
            model_dir = settings.model_dir
            sys.path.insert(0, str(model_dir))
            import cardiosense_beats as cb

            # Prefer TorchScript (no architecture rebuild needed at load)
            ts = model_dir / "beat_model_ts.pt"
            cfg = model_dir / "model_config.json"
            try:
                self._clf = cb.BeatClassifier(str(ts), str(cfg), device="cpu")
                self.state = MLState(ready=True, version=self._clf.cfg.get("model_version"))
            except Exception as exc:  # noqa: BLE001
                self.state = MLState(ready=False, error=str(exc))
                raise

    @property
    def ready(self) -> bool:
        return self.state.ready and self._clf is not None

    def classify_chunk(self, samples: np.ndarray, fs: float) -> list[dict]:
        if self._clf is None:
            self.load()
        assert self._clf is not None
        return self._clf.classify(np.asarray(samples, dtype=np.float64), fs)


inference = BeatInference()
