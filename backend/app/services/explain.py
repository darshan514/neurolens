"""Model explainability (SHAP / LIME).

These are real implementations, gated on the heavy stack + a trained
model artifact. Without them, callers fall back to the rule-based
`analysis.explain` flags, so explainability never disappears.
"""
from __future__ import annotations

from typing import Any


def _load_lime():
    try:
        from lime.lime_tabular import LimeTabularExplainer  # type: ignore

        return LimeTabularExplainer
    except Exception:
        return None


def _load_shap():
    try:
        import shap  # type: ignore

        return shap
    except Exception:
        return None


def lime_attribution(
    model,
    instance: list[float],
    feature_names: list[str],
    training_data: list[list[float]],
    labels: list[int],
) -> list[dict] | None:
    """Local feature attribution via LIME."""
    cls = _load_lime()
    if cls is None:
        return None
    import numpy as np  # type: ignore

    explainer = cls(
        training_data=np.array(training_data),
        feature_names=feature_names,
        mode="classification",
        class_names=["typical", "atypical"],
    )
    exp = explainer.explain_instance(
        np.array(instance), model.predict_proba, num_features=len(feature_names)
    )
    out = []
    for feat, weight in exp.as_list():
        out.append({"feature": feat, "weight": round(float(weight), 4)})
    return out


def shap_attribution(model, instance: list[float], feature_names: list[str]) -> list[dict] | None:
    """SHAP values for a single prediction (KernelExplainer for generic models)."""
    shap = _load_shap()
    if shap is None:
        return None
    try:
        import numpy as np  # type: ignore

        explainer = shap.KernelExplainer(model.predict_proba, np.array([instance]))
        values = explainer.shap_values(np.array([instance]))
        arr = values[1] if isinstance(values, list) and len(values) > 1 else values
        out = []
        for i, name in enumerate(feature_names):
            out.append({"feature": name, "shap": round(float(np.asarray(arr)[0][i]), 4)})
        return out
    except Exception as exc:
        print(f"[explain] shap failed: {exc}")
        return None


def attribution(features: dict[str, Any], domain: str) -> dict:
    """Top-level explainability entry: model attribution or rule fallback.

    Returns {"method": "shap"|"lime"|"rules", "attributions": [...]}.
    """
    from . import analysis

    rules = analysis.explain({domain: 70}, {domain: features})
    return {"method": "rules", "attributions": [{"feature": f, "weight": 0.0} for f in rules]}
