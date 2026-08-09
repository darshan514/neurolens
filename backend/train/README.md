# Training

## Pipeline

```
data/  (CSV or audio) ─► train_voice.py ─► models/voice_xgb.bin      (voice classifier)
                      ─► train_fusion.py ─► models/fusion_risk.bin   (fusion over domain scores)
                                              │
API loads artifacts from NL_MODEL_DIR (default "models/")
  → /api/health reports ml_ready: true
  → predict_risk() / predict_voice_features() return model probabilities
```

## Dataset contract

**voice_features.csv** — one row per recording:
`id,label,f0_hz,jitter,shimmer,hnr_db,energy,pauses_per_min,speech_rate,pitch_variation`
(label: `0` = typical, `1` = atypical/parkinsonian)

**domain_scores.csv** — one row per screening report:
`id,label,voice,tap,spiral,tremor,walking,facial,balance,reaction,cognitive`

### Getting real data
- **PPMI (Parkinson's Progression Markers Initiative)** — ppmi-info.org; apply for access; speech/motor data available after approval.
- **mPower** — Sage Bionetworks mobile Parkinson's study (voice, tap, gait, balance from phones).
- **eKar / PC-GITA** — Parkinson's speech corpora (read more at gita.edu.co).
- **TasA / other speech corpora** — any labeled PD vs control recordings work for the voice classifier.

Convert whatever you receive into the CSVs above (feature extraction: `backend/app/services/analysis.py::extract_voice_features` produces exactly these columns from a .wav file).

## Smoke test (no real data needed)

```bash
cd backend
.venv/Scripts/python -m pip install scikit-learn xgboost joblib pandas
.venv/Scripts/python -m train.make_synthetic_dataset
.venv/Scripts/python -m train.train_voice     # -> models/voice_xgb.bin
.venv/Scripts/python -m train.train_fusion    # -> models/fusion_risk.bin
# restart the API → /api/health shows ml_ready: true
```

⚠️ Synthetic data only proves the pipeline runs. Never ship a model trained on it.

## GPU

- RTX 4050 (6 GB) detected on the dev machine — plenty for Wav2Vec2-base fine-tuning.
- Install CUDA torch first:
  ```bash
  pip install torch --index-url https://download.pytorch.org/whl/cu121
  pip install -r requirements-train.txt
  ```
- For embedding-based voice training: `python -m train.train_voice --embed <dir of id_label.wav files>`
