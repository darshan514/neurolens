"""Server-side multimodal analysis pipeline.

The browser already extracts acoustic / motor / sensor features for
latency and privacy. This module is the authoritative pipeline used
when recordings are uploaded: it re-derives features with librosa and
scipy, fuses domain scores into the risk estimate and produces the
plain-language explanation payload (SHAP/LIME hooks live here too).

All heavy ML imports are guarded so the core API runs without them.
"""
from __future__ import annotations

import math
from typing import Any

try:  # optional heavy stack
    import numpy as np
    import librosa
    HAVE_LIBROSA = True
except Exception:  # pragma: no cover
    HAVE_LIBROSA = False

# Domain fusion weights — mirrors frontend/src/lib/scoring.ts
DOMAIN_WEIGHTS = {
    "voice": 0.16,
    "tap": 0.12,
    "spiral": 0.12,
    "tremor": 0.14,
    "walking": 0.10,
    "facial": 0.10,
    "balance": 0.08,
    "reaction": 0.08,
    "cognitive": 0.10,
}

HEALTHY_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "voice": {"jitter": (0, 1.0), "shimmer": (0, 3.5), "hnr_db": (20, 30)},
    "tap": {"tap_rate": (4.0, 7.5), "variability": (0, 0.15)},
    "tremor": {"amplitude": (0, 0.2)},
    "walking": {"cadence": (90, 130), "step_variability": (0, 0.12)},
    "reaction": {"mean_ms": (200, 380)},
}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _linear(value: float, healthy: tuple[float, float], worst: float) -> float:
    """Map a feature into a 0–100 health score (higher = healthier)."""
    lo, hi = healthy
    if lo <= value <= hi:
        return 100.0
    dist = lo - value if value < lo else value - hi
    span = (lo - worst) if value < lo else (worst - hi)
    return _clamp(100.0 * (1.0 - dist / max(span, 1e-6)), 0, 100)


# ------------------------------------------------------------- voice

def extract_voice_features(audio_path: str, sr: int = 16_000) -> dict[str, Any]:
    """librosa-based acoustic feature extraction from an audio file.

    Returns: f0_hz, jitter, shimmer, hnr_db, energy, pauses_per_min,
    speech_rate, pitch_variation, voiced_ratio, quality.
    """
    if not HAVE_LIBROSA:
        raise RuntimeError("librosa is not installed (pip install -r requirements-ml.txt)")

    y, _ = librosa.load(audio_path, sr=sr, mono=True)
    duration = len(y) / sr

    # frame energies + noise floor (10th percentile)
    hop = 160  # 10 ms
    frame_len = 480  # 30 ms
    energies = [
        float(np.sqrt(np.mean(y[i : i + frame_len] ** 2)))
        for i in range(0, max(1, len(y) - frame_len), hop)
    ]
    noise_floor = float(np.percentile(energies, 10)) if energies else 1e-6

    # pitch via librosa.pyin (f0 + voiced flag + voicing confidence)
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=60, fmax=400, sr=sr, frame_length=frame_len, hop_length=hop
    )
    f0_arr = f0[voiced_flag & (voiced_prob > 0.7)]
    f0_clean = [float(v) for v in f0_arr if not math.isnan(v)]

    periods = [1.0 / v for v in f0_clean]
    jitter = 0.0
    if len(periods) > 3:
        mean_p = sum(periods) / len(periods)
        jitter = (
            sum(abs(periods[i] - periods[i - 1]) for i in range(1, len(periods)))
            / (len(periods) - 1)
            / mean_p
            * 100.0
        )

    voiced_rms = [e for e, v in zip(energies, voiced_flag) if bool(v)]
    shimmer = 0.0
    if len(voiced_rms) > 3:
        mean_a = sum(voiced_rms) / len(voiced_rms)
        shimmer = (
            sum(abs(voiced_rms[i] - voiced_rms[i - 1]) for i in range(1, len(voiced_rms)))
            / (len(voiced_rms) - 1)
            / mean_a
            * 100.0
        )

    # HNR proxy from voicing strength
    vp = float(np.nanmean(voiced_prob)) if len(voiced_prob) else 0.5
    hnr_db = float(_clamp(10 * math.log10(max(vp, 0.001) / max(1 - vp, 0.001)), -5, 40))

    # pauses: unvoiced runs > 150 ms
    pause_min_frames = int(0.150 / (hop / sr))
    pauses = 0
    run = 0
    for v in voiced_flag:
        run = run + 1 if not v else 0
        if run == pause_min_frames:
            pauses += 1
    pauses_per_min = pauses / (duration / 60.0) if duration > 0 else 0.0

    # speech-rate proxy: syllables via onset envelope peaks
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    threshold = float(np.mean(onset_env) * 0.6)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, hop_length=hop, delta=threshold, wait=12
    )
    speech_rate = float(len(onsets) / duration) if duration > 0 else 0.0

    mean_f0 = float(np.mean(f0_clean)) if f0_clean else 0.0
    pitch_variation = float(np.std(f0_clean)) if len(f0_clean) > 2 else 0.0
    voiced_ratio = float(np.mean(voiced_flag)) if len(voiced_flag) else 0.0
    mean_energy = float(np.mean(energies)) if energies else 0.0
    peak = float(np.max(energies)) if energies else 1e-6
    snr = 10 * math.log10((peak * peak) / (noise_floor * noise_floor + 1e-12))
    quality = _clamp(50 + (snr / 40.0) * 50, 0, 100)

    return {
        "f0_hz": round(mean_f0),
        "jitter": round(jitter, 2),
        "shimmer": round(shimmer, 2),
        "hnr_db": round(hnr_db, 2),
        "energy": round(mean_energy, 4),
        "pauses_per_min": round(pauses_per_min, 2),
        "speech_rate": round(speech_rate, 2),
        "pitch_variation": round(pitch_variation),
        "voiced_ratio": round(voiced_ratio, 3),
        "quality": round(quality),
    }


# ------------------------------------------------------------- fusion

def score_domain(domain: str, features: dict[str, Any], confidence: float = 80.0) -> dict[str, Any]:
    """Score one domain from its raw features (mirrors frontend scoring)."""
    if domain == "voice":
        parts = [
            _linear(features.get("jitter", 0.4), (0, 1.0), 5),
            _linear(features.get("shimmer", 1.5), (0, 3.5), 15),
            _linear(features.get("hnr_db", 25), (20, 30), 0),
            _linear(features.get("pauses_per_min", 3), (0, 6), 25),
            _linear(features.get("speech_rate", 4.5), (3.5, 6), 0.8),
            _linear(features.get("pitch_variation", 60), (30, 90), 5),
        ]
        score = sum(parts) / len(parts)
    elif domain == "tremor":
        amp = features.get("amplitude", 0.1)
        score = _linear(amp, (0, 0.2), 3) * 0.7 + 30
    elif domain == "tap":
        score = (
            _linear(features.get("tap_rate", 5), (4, 7.5), 1) * 0.4
            + _linear(features.get("variability", 0.1), (0, 0.15), 0.6) * 0.3
            + _linear(features.get("fatigue_index", 1), (0.85, 1.15), 0.4) * 0.2
            + 80 * 0.1
        )
    elif domain == "walking":
        score = (
            _linear(features.get("cadence", 105), (90, 130), 40) * 0.5
            + _linear(features.get("step_variability", 0.08), (0, 0.12), 0.5) * 0.35
            + _linear(features.get("swing_symmetry", 0.9), (0.8, 1), 0.3) * 0.15
        )
    elif domain == "balance":
        score = _linear(features.get("sway", 0.1), (0, 0.12), 0.6) * 0.6 + 40
    elif domain == "reaction":
        score = _linear(features.get("mean_ms", 300), (200, 380), 900) * 0.7 + 30
    elif domain == "cognitive":
        score = (
            features.get("memory_score", 80) * 0.35
            + features.get("attention_score", 80) * 0.3
            + features.get("executive_score", 80) * 0.25
            + _linear(features.get("response_ms", 1200), (800, 1600), 4000) * 0.1
        )
    elif domain in ("spiral", "facial"):
        # drawing deviation / facial rigidity handled client-side for now
        score = features.get("score", 70)
    else:
        score = 70.0

    return {
        "domain": domain,
        "score": round(_clamp(score, 0, 100)),
        "confidence": round(confidence),
        "features": features,
    }


def fuse(domain_scores: dict[str, float]) -> tuple[float, str, float]:
    """Weighted fusion of domain scores -> (overall, risk, confidence)."""
    weighted = 0.0
    total_w = 0.0
    for domain, score in domain_scores.items():
        w = DOMAIN_WEIGHTS.get(domain, 0.1)
        weighted += score * w
        total_w += w
    overall = weighted / total_w if total_w > 0 else 0.0
    risk = "Low" if overall >= 65 else "Moderate" if overall >= 45 else "High"
    coverage = len(domain_scores) / len(DOMAIN_WEIGHTS)
    confidence = _clamp(85 * (0.55 + 0.45 * coverage), 0, 100)
    return round(overall), risk, round(confidence)


def explain(domain_scores: dict[str, float], features_by_domain: dict[str, dict]) -> list[str]:
    """Plain-language explanations for flagged features (rule-based now;
    swap for SHAP/LIME feature-attribution when models are deployed)."""
    out: list[str] = []
    for domain, feats in features_by_domain.items():
        ranges = HEALTHY_RANGES.get(domain, {})
        for key, (lo, hi) in ranges.items():
            if key in feats:
                v = float(feats[key])
                if v < lo or v > hi:
                    out.append(f"{domain} · {key} = {v} (typical {lo}–{hi})")
    if not out:
        out.append("All measured biomarkers were within typical ranges for this profile.")
    return out


# ------------------------------------------------------ placeholders

def shap_explanation(_model, _features):
    """Hook for SHAP feature attribution (requires torch/xgboost stack)."""
    raise NotImplementedError("SHAP integration lands with the trained models")


def lime_explanation(_model, _instance):
    """Hook for LIME local explanations."""
    raise NotImplementedError("LIME integration lands with the trained models")
