"""Train the multimodal fusion classifier.

Learns a risk model over the nine domain scores (the same 0–100
features the rule engine fuses). When an artifact exists, the API's
`predict_risk` activates and reports model probability alongside the
rule-based estimate.

Expected CSV columns:
    id,label,voice,tap,spiral,tremor,walking,facial,balance,reaction,cognitive

Usage:
    python -m train.train_fusion --data data/synthetic/domain_scores.csv \
        --out models/fusion_risk.bin
"""
from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

DOMAIN_COLS = [
    "voice",
    "tap",
    "spiral",
    "tremor",
    "walking",
    "facial",
    "balance",
    "reaction",
    "cognitive",
]


def main(data: str, out: str) -> None:
    df = pd.read_csv(data)
    X = df[DOMAIN_COLS].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=7, stratify=y
    )
    model = XGBClassifier(
        n_estimators=250,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.8,
        eval_metric="logloss",
        tree_method="hist",
    )
    # pass a DataFrame so XGBoost records feature_names_in_ for the API
    model.fit(pd.DataFrame(X_train, columns=DOMAIN_COLS), y_train)

    pred = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    print("Accuracy:", round(accuracy_score(y_test, pred), 4))
    print("ROC-AUC :", round(roc_auc_score(y_test, proba), 4))

    out_path = Path(out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)
    print(f"Saved fusion model -> {out_path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/synthetic/domain_scores.csv")
    ap.add_argument("--out", default="models/fusion_risk.bin")
    args = ap.parse_args()
    main(data=args.data, out=args.out)
