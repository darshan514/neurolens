# NeuroLens AI — Architecture

## 1. System overview

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  React SPA (Vite, TS)      │  REST  │  FastAPI backend              │
│  · Landing / auth          │ ─────► │  · JWT auth (email + Google)  │
│  · Dashboard & history     │        │  · Exam sessions & results    │
│  · 9 on-device tests       │  JSON  │  · Report fusion + PDF export │
│  · Explainable reports     │ ◄───── │  · Doctor portal + CSV        │
│  · i18n (en/ta/te/hi)      │        │  · LLM coach / summaries      │
└───────────┬────────────────┘        └──────────────┬───────────────┘
            │ on-device analysis                     │ SQLAlchemy
            ▼                                        ▼
  Web Audio / DeviceMotion /              PostgreSQL (Supabase in prod)
  touch / getUserMedia
```

**Design decision:** all signal processing runs in the browser first. This gives
latency, privacy, and offline capability; the backend re-derives features with
librosa/scipy when recordings are uploaded, and owns the authoritative fusion,
reporting and multi-user layers.

## 2. Screening pipeline

| Stage | Module | Output |
|---|---|---|
| Voice | `frontend/src/lib/audio.ts` → `backend/services/analysis.py` | f0, jitter, shimmer, HNR, pauses/min, speech rate, pitch variation, SNR quality |
| Finger tap | `frontend/src/pages/tests/FingerTapTest.tsx` | tap rate, interval CV, fatigue index, consistency |
| Spiral | `frontend/src/lib/drawing.ts` | deviation, jerk, speed, tremor freq/amp (FFT of radial residual), stability |
| Tremor | `frontend/src/lib/sensors.ts` | dominant freq (3–10 Hz), amplitude, RMS, stability |
| Gait | `frontend/src/lib/sensors.ts` | cadence, step variability, stride estimate, swing symmetry |
| Facial | `frontend/src/pages/tests/FacialTest.tsx` | blink rate, smile amplitude, rigidity, expressiveness, lighting |
| Balance | `frontend/src/lib/sensors.ts` | sway, path length, stability |
| Reaction | `frontend/src/pages/tests/ReactionTest.tsx` | mean ms, variability, premature taps |
| Cognitive | `frontend/src/pages/tests/CognitiveTest.tsx` | recall, digit span, Stroop accuracy + response time |

Each domain is scored 0–100 against known healthy reference ranges
(`frontend/src/lib/scoring.ts`, mirrored in `backend/services/analysis.py`).

## 3. Fusion & explainability

1. Per-domain scores are weighted (voice .16, tremor .14, motor .12 each, …).
2. Overall = weighted mean; risk bands: ≥65 Low, 45–64 Moderate, <45 High.
3. Confidence = mean domain confidence scaled by domain coverage (fewer domains → lower confidence).
4. Explanations: every out-of-range feature is reported with its value and typical range,
   in plain language; the health coach turns these into natural-language messages.
5. SHAP/LIME hooks exist in `backend/services/analysis.py` for the trained-model phase.

## 4. Data model (backend)

- `users` — role (patient/doctor/caregiver), height, language, research consent
- `exam_sessions` → `exam_results` (domain, score, confidence, features JSON, flags, notes)
- `reports` — fused overall/risk/confidence, domain scores, explanations, doctor summary
- `medication_logs` — before/after dose scores

## 5. Security & privacy

- JWT (HS256) access tokens; bcrypt password hashing; role-guarded doctor routes
- HTTPS in production; CORS restricted to the frontend origin
- Consent management: `research_consent` flag on the user; anonymization layer planned
- Audio/video never uploaded in the current on-device build

## 6. ML roadmap

| Task | Current | Planned |
|---|---|---|
| Voice embeddings | rule-based features | Wav2Vec2 / HuBERT + XGBoost classifier |
| Spiral | geometric features | Vision Transformer / CNN |
| Gait | step detection | MoveNet pose + LSTM |
| Facial | motion proxy (beta) | MediaPipe Face Mesh + MLP |
| Tremor | FFT features | Temporal CNN / LSTM |
| Fusion | weighted rule fusion | Multimodal Transformer / MLP fusion network |
| Explainability | rule-based flags | SHAP + LIME attribution |

## 7. Deployment

- Frontend: Vercel
- Backend: Railway / Render (Dockerfile included)
- DB: Supabase PostgreSQL
- Storage: Cloudinary (audio/video uploads when cloud analysis is enabled)
- CI/CD: GitHub Actions (lint → typecheck → test → build → deploy)
