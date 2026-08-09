"""Research platform.

Only consented users' reports appear, and always anonymized
(pseudonymous ID, no PII). Access is restricted to doctor/researcher
roles.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import Report, User
from ..services.anonymize import pseudonymous_id

router = APIRouter(prefix="/api/research", tags=["research"])

researcher = require_roles("doctor", "researcher")


@router.get("/summary")
def research_summary(_: User = Depends(researcher), db: Session = Depends(get_db)):
    """Anonymized aggregate statistics over the consented cohort."""
    consented = db.scalars(select(User).where(User.research_consent == True)).all()  # noqa: E712
    ids = [u.id for u in consented]
    if not ids:
        return {"cohort_size": 0, "reports": 0, "risk_bands": {}, "avg_overall": None}

    reports = db.scalars(select(Report).where(Report.user_id.in_(ids))).all()
    bands: dict[str, int] = {}
    total = 0.0
    for r in reports:
        bands[r.risk] = bands.get(r.risk, 0) + 1
        total += r.overall
    return {
        "cohort_size": len(ids),
        "reports": len(reports),
        "risk_bands": bands,
        "avg_overall": round(total / len(reports), 1) if reports else None,
        "note": "Aggregates only; no individual records exposed.",
    }


@router.get("/cohort")
def research_cohort(_: User = Depends(researcher), db: Session = Depends(get_db)):
    """Anonymized rows for dataset export (pseudonymous IDs only)."""
    consented = db.scalars(select(User).where(User.research_consent == True)).all()  # noqa: E712
    rows = []
    for u in consented:
        for r in u.reports:
            rows.append(
                {
                    "id": pseudonymous_id(u.id),
                    "date": r.created_at.isoformat(),
                    "overall": r.overall,
                    "risk": r.risk,
                    "domain_scores": r.domain_scores,
                }
            )
    return rows
