"""Generate a SYNTHETIC dataset for pipeline smoke-testing.

This is NOT clinical data and must never be used for a real model.
It exists so `train_voice.py` / `train_fusion.py` can be validated
end-to-end on machines that don't yet have an approved dataset.

Healthy subjects sample features from typical ranges; atypical subjects
sample degraded values (higher jitter/shimmer, lower HNR, slower rate,
worse motor scores, etc.) so the classifier has a learnable signal.

Usage:
    python -m train.make_synthetic_dataset [--n 400] [--out data/synthetic]
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import pandas as pd


def _between(rng: random.Random, lo: float, hi: float) -> float:
    return rng.uniform(lo, hi)


def sample_voice(rng: random.Random, atypical: bool) -> dict:
    if atypical:
        return {
            "f0_hz": round(rng.uniform(95, 135), 1),
            "jitter": round(rng.uniform(1.2, 3.5), 2),
            "shimmer": round(rng.uniform(4.0, 11.0), 2),
            "hnr_db": round(rng.uniform(5, 16), 1),
            "energy": round(rng.uniform(0.02, 0.08), 4),
            "pauses_per_min": round(rng.uniform(8, 20), 1),
            "speech_rate": round(rng.uniform(1.2, 3.0), 2),
            "pitch_variation": round(rng.uniform(8, 26), 1),
        }
    return {
        "f0_hz": round(rng.uniform(110, 170), 1),
        "jitter": round(rng.uniform(0.2, 0.9), 2),
        "shimmer": round(rng.uniform(1.2, 3.2), 2),
        "hnr_db": round(rng.uniform(20, 32), 1),
        "energy": round(rng.uniform(0.04, 0.12), 4),
        "pauses_per_min": round(rng.uniform(1, 6), 1),
        "speech_rate": round(rng.uniform(3.6, 5.6), 2),
        "pitch_variation": round(rng.uniform(32, 88), 1),
    }


def sample_domains(rng: random.Random, atypical: bool) -> dict:
    domains = ["voice", "tap", "spiral", "tremor", "walking", "facial", "balance", "reaction", "cognitive"]
    if atypical:
        base = {d: rng.uniform(28, 55) for d in domains}
    else:
        base = {d: rng.uniform(65, 96) for d in domains}
    return {d: round(v + rng.uniform(-4, 4)) for d, v in base.items()}


def main(n: int = 400, out: str = "data/synthetic") -> None:
    rng = random.Random(42)
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)

    voice_rows = []
    domain_rows = []
    for i in range(n):
        atypical = i % 2 == 0  # balanced classes for the smoke test
        label = 1 if atypical else 0
        voice_rows.append({"id": f"subj_{i}", "label": label, **sample_voice(rng, atypical)})
        domain_rows.append({"id": f"subj_{i}", "label": label, **sample_domains(rng, atypical)})

    pd.DataFrame(voice_rows).to_csv(out_dir / "voice_features.csv", index=False)
    pd.DataFrame(domain_rows).to_csv(out_dir / "domain_scores.csv", index=False)
    print(f"Wrote {n} synthetic subjects to {out_dir}/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=400)
    ap.add_argument("--out", default="data/synthetic")
    main(**vars(ap.parse_args()))
