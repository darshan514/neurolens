"""ML model registry.

Wires the trained-model pipeline that the rule-based engine currently
stands in for. Everything is guarded: without the heavy stack installed
(see requirements-ml.txt) or a trained artifact present, calls return
None and the API falls back to the rule-based scorer.

Training data is a research milestone — these loaders exist so the
inference path is ready the moment a checkpoint exists.
"""
from __future__ import annotations

import os
from typing import Any

MODEL_DIR = os.getenv("NL_MODEL_DIR", "models")
VOICE_ENCODER = os.getenv("NL_VOICE_ENCODER", "facebook/wav2vec2-base")
FUSION_MODEL_PATH = os.path.join(MODEL_DIR, "fusion_risk.bin")
VOICE_CLF_PATH = os.path.join(MODEL_DIR, "voice_xgb.bin")
# Real-data model: UCI Parkinson's voice dataset (patient-level split)
UCI_VOICE_PATH = os.path.join(MODEL_DIR, "voice_uci_xgb.bin")
UCI_META_PATH = os.path.join(MODEL_DIR, "uci_meta.json")

try:
    import numpy as np

    HAVE_NP = True
except Exception:  # pragma: no cover
    HAVE_NP = False

try:
    import librosa

    HAVE_LIBROSA = True
except Exception:  # pragma: no cover
    HAVE_LIBROSA = False


def _load_transformers():
    """Lazily import HF transformers; returns None when unavailable."""
    try:
        from transformers import AutoFeatureExtractor, AutoModel  # type: ignore

        return AutoFeatureExtractor, AutoModel
    except Exception:
        return None


_voice_pipeline = None


def voice_pipeline():
    """Singleton (feature_extractor, model) or None."""
    global _voice_pipeline
    if _voice_pipeline is not None:
        return _voice_pipeline
    if not HAVE_LIBROSA or _load_transformers() is None:
        return None
    try:
        extractor_cls, model_cls = _load_transformers()
        extractor = extractor_cls.from_pretrained(VOICE_ENCODER)
        model = model_cls.from_pretrained(VOICE_ENCODER)
        _voice_pipeline = (extractor, model)
    except Exception as exc:  # no model weights available offline
        print(f"[models] voice encoder unavailable: {exc}")
        _voice_pipeline = False
    return _voice_pipeline if _voice_pipeline else None


def embed_voice(audio_path: str, sr: int = 16_000) -> dict | None:
    """Mean-pooled Wav2Vec2/HuBERT embedding for a recording.

    Returns {"embedding": list[float], "dim": int} or None when the
    encoder stack is unavailable.
    """
    pipe = voice_pipeline()
    if pipe is None or not HAVE_LIBROSA:
        return None
    try:
        import torch  # type: ignore

        extractor, model = pipe
        y, _ = librosa.load(audio_path, sr=sr, mono=True)
        inputs = extractor(y, sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            hidden = model(**inputs).last_hidden_state
        pooled = hidden.mean(dim=1).squeeze(0).tolist()
        return {"embedding": pooled, "dim": len(pooled)}
    except Exception as exc:
        print(f"[models] embedding failed: {exc}")
        return None


def _predict_artifact(path: str, features: dict[str, Any]) -> dict | None:
    """Shared inference over a trained artifact; aligns columns via
    model.feature_names_in_ when available (trained with XGBoost)."""
    if not os.path.exists(path):
        return None
    try:
        import joblib  # type: ignore
        import numpy as np

        model = joblib.load(path)
        raw_names = getattr(model, "feature_names_in_", None)
        names = list(raw_names) if raw_names is not None else sorted(features)
        row = np.array([[features.get(n, 0.0) for n in names]]).reshape(1, -1)
        proba = float(model.predict_proba(row)[0, 1])
        return {"probability": round(proba, 4), "class": int(proba >= 0.5)}
    except Exception as exc:
        print(f"[models] inference failed for {path}: {exc}")
        return None


def predict_risk(features: dict[str, Any]) -> dict | None:
    """Fusion classifier over domain scores. None when no artifact exists."""
    return _predict_artifact(FUSION_MODEL_PATH, features)


_uci_cache = None


def _load_uci():
    """Lazy-load (model, meta) for the UCI voice model; False when absent."""
    global _uci_cache
    if _uci_cache is not None:
        return _uci_cache if _uci_cache else None
    if not (os.path.exists(UCI_VOICE_PATH) and os.path.exists(UCI_META_PATH)):
        _uci_cache = False
        return None
    try:
        import json
        from pathlib import Path

        import joblib  # type: ignore

        model = joblib.load(UCI_VOICE_PATH)
        meta = json.loads(Path(UCI_META_PATH).read_text(encoding="utf-8"))
        _uci_cache = (model, meta)
    except Exception as exc:
        print(f"[models] UCI voice model load failed: {exc}")
        _uci_cache = False
        return None
    return _uci_cache


def predict_voice_features(features: dict[str, Any]) -> dict:
    """App-facing voice assessment (HONEST).

    We trained a real model on the UCI Parkinson's dataset with a
    patient-level split. Its signal comes from nonlinear measures the
    on-device pipeline cannot extract, so the app-compatible subset has
    no discriminative power (AUC ~0.50). Reporting a "probability" for
    those features would be misleading in a health product, so this
    returns a transparency payload instead — the rule-based scorer
    (designed for within-person longitudinal monitoring) remains the
    on-device assessment.
    """
    loaded = _load_uci()
    if loaded is None:
        return {
            "available": False,
            "note": "No trained voice model artifact present.",
        }
    _, meta = loaded
    metrics = meta.get("metrics", {})
    return {
        "available": True,
        "model": "uci-xgb-22f",
        "probability": None,  # intentionally not reported — see note
        "metrics": metrics,
        "note": metrics.get(
            "warning",
            "On-device acoustic features lack patient-level discriminative signal; "
            "full 22-feature analysis requires uploaded recordings.",
        ),
    }


def predict_voice_full(features: dict[str, Any]) -> dict | None:
    """Full 22-feature UCI model inference (server-side recording analysis).
    Returns probability only when all required features are provided."""
    loaded = _load_uci()
    if loaded is None:
        return None
    try:
        import numpy as np

        model, meta = loaded
        names = meta["features"]
        missing = [c for c in names if c not in features]
        if missing:
            return None
        row = np.array([[features[c] for c in names]]).reshape(1, -1)
        proba = float(model.predict_proba(row)[0, 1])
        return {"probability": round(proba, 4), "class": int(proba >= 0.5), "model": "uci-xgb-22f"}
    except Exception as exc:
        print(f"[models] UCI full inference failed: {exc}")
        return None


def predict_voice_abnormal(embedding: list[float]) -> dict | None:
    """Voice classifier over Wav2Vec2 embeddings (checkpoint-gated)."""
    if not os.path.exists(VOICE_CLF_PATH):
        return None
    try:
        import joblib

        model = joblib.load(VOICE_CLF_PATH)
        proba = float(model.predict_proba([embedding])[0, 1])
        return {"probability": round(proba, 4), "abnormal": proba >= 0.5}
    except Exception as exc:
        print(f"[models] voice inference failed: {exc}")
        return None


def is_ml_ready() -> bool:
    """Whether any trained artifact is present (used by /api/health)."""
    return (
        os.path.exists(FUSION_MODEL_PATH)
        or os.path.exists(VOICE_CLF_PATH)
        or os.path.exists(UCI_VOICE_PATH)
    )
