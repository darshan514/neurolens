import csv
import io
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import Report, User
from ..schemas import PatientOut

router = APIRouter(prefix="/api/doctor", tags=["doctor"])

doctor_only = require_roles("doctor")


@router.get("/patients", response_model=list[PatientOut])
def list_patients(_: User = Depends(doctor_only), db: Session = Depends(get_db)):
    patients = db.scalars(select(User).where(User.role == "patient", User.is_active)).all()
    out: list[PatientOut] = []
    for p in patients:
        latest = db.scalars(
            select(Report).where(Report.user_id == p.id).order_by(Report.created_at.desc()).limit(1)
        ).first()
        count = db.scalar(select(func.count(Report.id)).where(Report.user_id == p.id)) or 0
        # 8-week trend: latest vs oldest within the window
        since = datetime.utcnow() - timedelta(weeks=8)
        window = db.scalars(
            select(Report).where(Report.user_id == p.id, Report.created_at >= since).order_by(Report.created_at)
        ).all()
        trend = None
        if len(window) >= 2:
            trend = round(window[-1].overall - window[0].overall)
        out.append(
            PatientOut(
                id=p.id,
                name=p.name,
                email=p.email,
                role=p.role,
                last_report_overall=latest.overall if latest else None,
                last_report_risk=latest.risk if latest else None,
                report_count=count,
                trend_8w=trend,
            )
        )
    return out


@router.get("/patients/{patient_id}/reports")
def patient_reports(
    patient_id: int,
    _: User = Depends(doctor_only),
    db: Session = Depends(get_db),
):
    reports = db.scalars(
        select(Report).where(Report.user_id == patient_id).order_by(Report.created_at.desc())
    ).all()
    return [
        {
            "id": r.id,
            "date": r.created_at.isoformat(),
            "overall": r.overall,
            "risk": r.risk,
            "confidence": r.confidence,
            "domain_scores": r.domain_scores,
        }
        for r in reports
    ]


@router.get("/patients/{patient_id}/export")
def export_patient_csv(
    patient_id: int,
    _: User = Depends(doctor_only),
    db: Session = Depends(get_db),
):
    """CSV of a patient's report history (for the doctor dashboard)."""
    reports = db.scalars(
        select(Report).where(Report.user_id == patient_id).order_by(Report.created_at)
    ).all()
    if not reports:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No reports for this patient")

    all_domains: list[str] = []
    for r in reports:
        for d in r.domain_scores:
            if d not in all_domains:
                all_domains.append(d)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "overall", "risk", "confidence", *all_domains])
    for r in reports:
        writer.writerow(
            [r.created_at.isoformat(), r.overall, r.risk, r.confidence,
             *[r.domain_scores.get(d, "") for d in all_domains]]
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="patient-{patient_id}-reports.csv"'},
    )
