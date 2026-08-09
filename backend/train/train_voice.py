"""Train the voice / speech classifier.

Two modes:
1. Feature mode (default): XGBoost over the engineered acoustic
   features (jitter, shimmer, HNR, rate, …) from a CSV. This is the
   path that activates once real feature-extracted data exists.
2. Embedding mode (--embed): mean-pooled Wav2Vec2/HuBERT embeddings
   from a directory of audio files (needs torch + transformers).

Expected CSV columns:
    id,label,f0_hz,jitter,shimmer,hnr_db,energy,pauses_per_min,speech_rate,pitch_variation

Usage:
    python -m train.train_voice --data data/synthetic/voice_features.csv \
        --out models/voice_xgb.bin
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

FEATURE_COLS = [
    "f0_hz",
    "jitter",
    "shimmer",
    "hnr_db",
    "energy",
    "pauses_per_min",
    "speech_rate",
    "pitch_variation",
]


def main(data: str, out: str, embed: str | None = None) -> None:
    df = pd.read_csv(data)
    if embed:
        # directory of .wav files named <id>_<label>.wav
        feats = []
        labels = []
        for wav in sorted(Path(embed).glob("*.wav")):
            label = int(wav.stem.split("_")[-1])
            emb = embed_file(wav)
            if emb is not None:
                feats.append(emb)
                labels.append(label)
        X = np.array(feats)
        y = np.array(labels)
        names = [f"emb_{i}" for i in range(X.shape[1])]
    else:
        X = df[FEATURE_COLS].values
        y = df["label"].values
        names = FEATURE_COLS

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    model = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        tree_method="hist",  # "gpu_hist" when a CUDA build is installed
    )
    # pass a DataFrame so XGBoost records feature_names_in_ and the API
    # feeds columns in the exact training order (prevents silent misalignment)
    model.fit(pd.DataFrame(X_train, columns=names), y_train)

    pred = model.predict(pd.DataFrame(X_test, columns=names))
    proba = model.predict_proba(X_test)[:, 1]
    print("Accuracy :", round(accuracy_score(y_test, pred), 4))
    print("ROC-AUC  :", round(roc_auc_score(y_test, proba), 4))
    print(classification_report(y_test, pred, target_names=["typical", "atypical"], digits=3))

    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)
    (out_path.parent / "voice_features.json").write_text(json.dumps(names))
    print(f"Saved model -> {out_path} ({out_path.stat().st_size // 1024} kB)")


def embed_file(wav: Path):
    """Mean-pooled Wav2Vec2/HuBERT embedding, or None if the stack is missing."""
    try:
        import librosa  # type: ignore
        import torch  # type: ignore
        from transformers import AutoFeatureExtractor, AutoModel  # type: ignore

        extractor = AutoFeatureExtractor.from_pretrained("facebook/wav2vec2-base")
        model = AutoModel.from_pretrained("facebook/wav2vec2-base")
        y, sr = librosa.load(wav, sr=16_000, mono=True)
        inputs = extractor(y, sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            hidden = model(**inputs).last_hidden_state
        return hidden.mean(dim=1).squeeze(0).tolist()
    except Exception as exc:
        print(f"[embed] unavailable ({exc}) — install requirements-train.txt")
        return None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/synthetic/voice_features.csv")
    ap.add_argument("--out", default="models/voice_xgb.bin")
    ap.add_argument("--embed", default=None, help="optional dir of <id>_<label>.wav files")
    args = ap.parse_args()
    main(data=args.data, out=args.out, embed=args.embed)
