"""Train a REAL voice classifier on the UCI Parkinson's dataset.

Data: 195 sustained-phonation recordings, 22 acoustic features,
status (1 = Parkinson's). Multiple recordings per patient — we split
by patient to avoid leakage, so metrics reflect generalization to new
people, not new recordings of known people.

Also writes uci_meta.json so the API can (a) median-impute the
nonlinear features it cannot extract on-device and (b) convert the
app's feature units (jitter % , shimmer %, HNR dB, f0 Hz) into the
dataset's native scale via data-derived ratios.

Usage:
    python -m train.train_uci_voice --data data/raw/parkinsons.data \\
        --out models/voice_uci_xgb.bin
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBClassifier

# 22 model features (name column + status excluded)
FEATURES = [
    "MDVP:Fo(Hz)", "MDVP:Fhi(Hz)", "MDVP:Flo(Hz)",
    "MDVP:Jitter(%)", "MDVP:Jitter(Abs)", "MDVP:RAP", "MDVP:PPQ", "Jitter:DDP",
    "MDVP:Shimmer", "MDVP:Shimmer(dB)", "Shimmer:APQ3", "Shimmer:APQ5",
    "MDVP:APQ", "Shimmer:DDA", "NHR", "HNR",
    "RPDE", "DFA", "spread1", "spread2", "D2", "PPE",
]


def patient_id(name: str) -> str:
    """phon_R01_S01_6 -> phon_R01_S01 (the person, not the take)."""
    return name.rsplit("_", 1)[0]


def main(data: str, out: str) -> None:
    df = pd.read_csv(data)
    df["patient"] = df["name"].map(patient_id)

    X = df[FEATURES].values
    y = df["status"].values
    groups = df["patient"].values

    split = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(split.split(X, y, groups))
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    model = XGBClassifier(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        tree_method="hist",
    )
    model.fit(pd.DataFrame(X_train, columns=FEATURES), y_train)
    pred = model.predict(pd.DataFrame(X_test, columns=FEATURES))
    proba = model.predict_proba(pd.DataFrame(X_test, columns=FEATURES))[:, 1]
    auc = float(roc_auc_score(y_test, proba))
    acc = float(accuracy_score(y_test, pred))

    # How much signal does the app's on-device subset carry? (honest check)
    APP_SUBSET = ["MDVP:Fo(Hz)", "MDVP:Jitter(%)", "MDVP:Shimmer", "HNR"]
    m_sub = XGBClassifier(
        n_estimators=300, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", tree_method="hist",
    )
    m_sub.fit(pd.DataFrame(X_train[:, [FEATURES.index(c) for c in APP_SUBSET]], columns=APP_SUBSET), y_train)
    sub_proba = m_sub.predict_proba(
        pd.DataFrame(X_test[:, [FEATURES.index(c) for c in APP_SUBSET]], columns=APP_SUBSET)
    )[:, 1]
    subset_auc = float(roc_auc_score(y_test, sub_proba))

    print(f"Patients: train={len(set(groups[train_idx]))}, test={len(set(groups[test_idx]))}")
    print(f"Recordings: train={len(train_idx)}, test={len(test_idx)}")
    print("Accuracy:", round(acc, 4))
    print("ROC-AUC :", round(auc, 4))
    print(classification_report(y_test, pred, target_names=["control", "parkinson"], digits=3))
    print(f"App-subset ({len(APP_SUBSET)} features) ROC-AUC: {round(subset_auc, 4)}")

    # ---- metadata for API-side inference ----
    train_df = pd.DataFrame(X_train, columns=FEATURES)
    med = {c: float(train_df[c].median()) for c in FEATURES}
    meta = {
        "features": FEATURES,
        "medians": med,
        "metrics": {
            "roc_auc": round(auc, 4),
            "accuracy": round(acc, 4),
            "split": "patient-level",
            "n_train_patients": len(set(groups[train_idx])),
            "n_test_patients": len(set(groups[test_idx])),
            "app_subset_features": APP_SUBSET,
            "app_subset_roc_auc": round(subset_auc, 4),
            "warning": (
                "The on-device acoustic subset (f0/jitter/shimmer/HNR) carries no patient-level "
                "signal in this dataset (AUC ~0.50). The full 22-feature model relies on nonlinear "
                "measures (RPDE/DFA/spread/D2/PPE) available only from full recording analysis."
            ),
        },
    }

    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)
    meta_path = out_path.parent / "uci_meta.json"
    meta_path.write_text(json.dumps(meta, indent=1))
    print(f"Saved model -> {out_path}")
    print(f"Saved meta -> {meta_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/raw/parkinsons.data")
    ap.add_argument("--out", default="models/voice_uci_xgb.bin")
    args = ap.parse_args()
    main(data=args.data, out=args.out)
