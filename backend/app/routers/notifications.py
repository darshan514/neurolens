"""Notifications & alerts.

Trend-engine alerts (e.g. score dropped ≥5 points in 2 weeks) are
created here; FCM push delivery is a pluggable step once credentials
exist.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Notification, Report, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)
    ).all()
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "title": n.title,
            "body": n.body,
            "read": n.read,
            "created_at": n.created_at.isoformat(),
        }
        for n in items
    ]


@router.post("/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return {"ok": False}
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/scan")
def scan_for_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Trend engine: create alerts when the 2-week trend drops ≥5 points."""
    since = datetime.utcnow() - timedelta(weeks=2)
    reports = db.scalars(
        select(Report).where(Report.user_id == user.id, Report.created_at >= since).order_by(Report.created_at)
    ).all()
    created = 0
    if len(reports) >= 2:
        drop = reports[0].overall - reports[-1].overall
        if drop >= 5:
            n = Notification(
                user_id=user.id,
                kind="trend",
                title="Trend flagged",
                body=f"Your overall score declined {round(drop)} points over the last 2 weeks. "
                "Consider discussing this with your neurologist.",
            )
            db.add(n)
            created += 1
    db.commit()
    return {"created": created}


@router.post("/family-alert")
def family_alert(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Caregivers can raise an alert on a patient record (demo delivery)."""
    target_id = body.get("patient_id")
    if not target_id:
        return {"ok": False, "error": "patient_id required"}
    n = Notification(
        user_id=int(target_id),
        kind="family",
        title="Family alert",
        body=f"A family member requested a check-in. ({body.get('note', '')})",
    )
    db.add(n)
    db.commit()
    # TODO: FCM push via firebase-admin when credentials are configured
    return {"ok": True, "delivery": "in-app (FCM pending credentials)"}
