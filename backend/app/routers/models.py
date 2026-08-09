from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..deps import get_current_user
from ..models import User
from ..services import models as ml

router = APIRouter(prefix="/api/models", tags=["models"])


class VoiceFeaturesIn(BaseModel):
    f0_hz: float | None = None
    jitter: float | None = None
    shimmer: float | None = None
    hnr_db: float | None = None
    energy: float | None = None
    pauses_per_min: float | None = None
    speech_rate: float | None = None
    pitch_variation: float | None = None


@router.post("/voice-predict")
def voice_predict(body: VoiceFeaturesIn, _user: User = Depends(get_current_user)):
    """On-device features: returns an honest transparency payload (the
    app-compatible subset has no patient-level signal — see model notes)."""
    feats = {k: v for k, v in body.model_dump().items() if v is not None}
    return ml.predict_voice_features(feats)


class VoiceFullIn(BaseModel):
    features: dict


@router.post("/voice-predict-full")
def voice_predict_full(body: VoiceFullIn, _user: User = Depends(get_current_user)):
    """Full 22-feature inference for server-side recording analysis."""
    prediction = ml.predict_voice_full(body.features)
    if prediction is None:
        return {"available": False, "reason": "Provide all 22 UCI features or install the model"}
    return {"available": True, **prediction}


@router.get("/status")
def model_status(_user: User = Depends(get_current_user)):
    return {
        "ml_ready": ml.is_ml_ready(),
        "voice_model": "uci-xgb" if ml._load_uci() else ("synthetic-smoke" if __import__("os").path.exists(ml.VOICE_CLF_PATH) else None),
        "fusion_model": __import__("os").path.exists(ml.FUSION_MODEL_PATH),
    }
