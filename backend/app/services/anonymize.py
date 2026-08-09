"""Anonymization for the opt-in research dataset.

Never include names/emails: reports are joined to a pseudonymous ID
derived from the user's id + a server-side pepper, and only consented
users' records enter the research views.
"""
from __future__ import annotations

import hashlib
import os
from typing import Any

PEPPER = os.getenv("NL_ANON_PEPPER", "change-me-pepper")


def pseudonymous_id(user_id: int) -> str:
    """Stable, irreversible pseudonymous ID for a user."""
    raw = f"{user_id}:{PEPPER}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def strip_pii(report: dict[str, Any], user_id: int, consent: bool) -> dict[str, Any] | None:
    """Return an anonymized research row, or None when consent is absent."""
    if not consent:
        return None
    return {
        "id": pseudonymous_id(user_id),
        "created_at": report.get("created_at"),
        "overall": report.get("overall"),
        "risk": report.get("risk"),
        "confidence": report.get("confidence"),
        "domain_scores": report.get("domain_scores", {}),
        # voice/tremor features are added here in the full pipeline after
        # feature extraction; raw audio is never stored in research views
        "features": report.get("features", {}),
    }
