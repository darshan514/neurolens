# NeuroLens AI 🧠

**AI-assisted digital neurological screening for Parkinson's disease and movement disorders.**

NeuroLens turns a smartphone into a digital neurological examination: voice, speech, finger
tapping, spiral drawing, tremor, gait, facial mobility, balance, reaction time and cognitive
mini-tests are fused into **one explainable multimodal risk estimate**, tracked over time
against the user's **own baseline**.

> ⚠️ **Screening aid — not a diagnostic tool.** NeuroLens estimates neurological risk from
> digital biomarkers. It does **not** diagnose Parkinson's disease or any other condition.
> Users are always directed to consult a qualified neurologist for clinical decisions.

---

## What's in this repo

| Path | What |
|---|---|
| `frontend/` | React + TypeScript + Vite + Tailwind SPA (landing, auth, dashboard, 9 screening tests, explainable reports, history, medication, doctor portal, i18n) |
| `backend/` | FastAPI + SQLAlchemy + JWT API (auth, exam sessions, reports, doctor portal, PDF export, LLM coach, librosa analysis pipeline) |
| `docker-compose.yml` | PostgreSQL + API for local dev |

The **screening tests run entirely in the browser** (Web Audio API, DeviceMotion, touch,
camera) so no data leaves the device — and the whole flow works offline. The backend is the
authoritative pipeline for cloud-synced recordings, reports and multi-user roles.

## Quick start

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
```

### Backend (needs PostgreSQL — or run `docker compose up -d db`)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # http://localhost:8000  (docs at /docs)
```

Optional heavy ML stack (librosa voice features, later: torch/transformers/SHAP):

```bash
pip install -r requirements-ml.txt
```

Environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `OPENAI_API_KEY`
(optional — LLM features fall back to templates without it).

### Full stack

```bash
docker compose up --build        # API :8000 + Postgres :5432
```

## Feature map

- **Landing page** — hero, AI explanation, biomarker features, workflow, stats, demo, FAQ, contact
- **Auth** — email + Google (JWT on backend, demo mode in the SPA)
- **Dashboard** — overall risk, speech/motor/tremor/dexterity/walking/facial scores, radar,
  weekly trends, baseline comparison, history, doctor recommendations
- **9 screening tests** — voice (jitter/shimmer/pitch/HNR/pauses/rate), finger tapping
  (rate/fatigue/variability), spiral drawing (deviation/jerk/tremor FFT), sensor tremor,
  gait, facial mobility, balance, reaction time, cognition (recall/digit-span/Stroop)
- **Explainable AI** — every score shows raw biomarkers, flags out-of-range features,
  plain-language explanations, confidence, recording-quality context
- **Personalized baseline** — comparisons vs the user's own history, not population averages
- **Weekly/monthly progression** — trend graphs, improvement/decline detection
- **Medication monitoring** — before/after dose logging and response charts
- **Health coach** — LLM-generated natural-language explanations (templated fallback)
- **Doctor portal** — patient list, trends, CSV export, LLM summaries, PDF reports
- **Multilingual** — English, தமிழ், తెలుగు, हिन्दी (framework ready for more)
- **Offline-first** — all signal processing on-device; sync when connectivity returns
- **Research opt-in** — anonymized data consent for a future research dataset
- **Security** — JWT, role-based access (patient/doctor/caregiver), HTTPS-ready, consent management

## Architecture

```
Voice → Speech features ─┐
Motor → Tap/spiral       ├─► Multimodal feature fusion ─► Risk prediction
Vision → Facial          │        (weighted, per-domain 0–100)
Sensors → Tremor/gait    ┘                 │
                                          ▼
                        Explainability (flags + plain language + confidence)
                                          │
                                   LLM report / coach ─► Dashboard & PDF
```

Details in [`docs/architecture.md`](docs/architecture.md).

## Status & roadmap

**Implemented:** SPA ↔ API wiring (auth, exam sessions, reports, medication) with a
local-first cache that queues offline mutations and flushes on reconnect; adaptive
examination; family dashboard; neurologist finder; alert center (trend engine + FCM
hook); medication effectiveness report; Kannada + Malayalam i18n; research platform;
model registry; SHAP/LIME hooks; route-level code splitting; CI/CD + deploy config.

**Live right now:**
- Frontend deployed on Vercel → https://frontend-omega-neon-66.vercel.app (demo mode —
  backend not yet hosted; local API runs on http://localhost:8000 with PostgreSQL 16)
- Real voice model trained on the UCI Parkinson's dataset (patient-level split,
  ROC-AUC 0.66) — `/api/models/voice-predict-full` scores full 22-feature vectors;
  the on-device acoustic subset has no patient-level signal (AUC ~0.50) and the app
  endpoint reports this honestly instead of faking a probability
- Backend runs on local PostgreSQL 16 (database `neurolens`)
- LLM coach wired to Gemini (key is quota-limited — enable billing in Google AI
  Studio; template fallback is automatic)

**Remaining (needs external resources, not code):**
1. Backend hosting — Render deploys from a GitHub repo or Docker image; create a repo
   and push (CI + `render.yaml` are ready), or provide a Docker Hub / Fly.io account
2. Supabase connection string + service role key if you want the cloud DB instead of local PG
3. More/better training data (mPower, PC-GITA, PPMI) to lift the voice model's AUC
4. Real Google OAuth / FCM / Maps credentials
5. Real-device validation (mic, motion sensors, camera) on physical phones
6. Clinical validation studies and regulatory review (CE/FDA pathway)

> ⚠️ Rotate all API keys/tokens shared in chat (Vercel, Render, Supabase, Gemini).

---

*Built for accessibility, transparency, longitudinal monitoring and clinical usefulness —
while clearly communicating that it is a screening aid rather than a diagnostic tool.*
