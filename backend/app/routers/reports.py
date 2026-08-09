from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import ExamSession, Report, User
from ..schemas import ReportIn, ReportOut
from ..services import analysis, llm, reporting

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _build_report(user: User, db: Session, session: ExamSession | None, domain_scores: dict | None) -> Report:
    """Fuse domain scores -> report with explanations + LLM summary."""
    if domain_scores is None:
        if session is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide a session_id or domain_scores")
        domain_scores = {r.domain: r.score for r in session.results}
    if not domain_scores:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No domain scores to fuse")

    overall, risk, confidence = analysis.fuse(domain_scores)
    features_by_domain = {}
    if session:
        features_by_domain = {r.domain: r.features for r in session.results}
    explanations = analysis.explain(domain_scores, features_by_domain)

    report = Report(
        user_id=user.id,
        overall=overall,
        risk=risk,
        confidence=confidence,
        domain_scores=domain_scores,
        explanations=explanations,
        recommendations=_recommendations(overall, domain_scores),
    )
    # LLM doctor summary (falls back to templates when no API key)
    try:
        report.doctor_summary = llm.doctor_summary(
            {
                "overall": overall,
                "risk": risk,
                "confidence": confidence,
                "domain_scores": domain_scores,
                "explanations": explanations,
            }
        )
    except Exception:
        report.doctor_summary = None
    return report


def _recommendations(overall: float, domain_scores: dict) -> list[str]:
    recs: list[str] = []
    if overall < 45:
        recs.append(
            "Multiple biomarkers are outside typical ranges. Please discuss these results with a neurologist "
            "or movement-disorder specialist."
        )
    elif overall < 65:
        recs.append(
            "A few biomarkers are borderline. Consider repeating this screening in 2–4 weeks and sharing "
            "results with your doctor."
        )
    else:
        recs.append("No immediate concerns from this screening. Continue your regular monitoring schedule.")
    weakest = sorted(domain_scores.items(), key=lambda kv: kv[1])[:2]
    if weakest and weakest[0][1] < 65:
        recs.append(f"Focus areas for your next session: {', '.join(d for d, _ in weakest)}.")
    recs.append(
        "NeuroLens is a screening aid, not a diagnostic device. It cannot diagnose Parkinson's disease "
        "or any other condition."
    )
    return recs


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(body: ReportIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = None
    if body.session_id is not None:
        session = db.scalar(
            select(ExamSession)
            .where(ExamSession.id == body.session_id, ExamSession.user_id == user.id)
            .options(selectinload(ExamSession.results))
        )
        if session is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    report = _build_report(user, db, session, body.domain_scores)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=list[ReportOut])
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc())
    ).all()


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report or report.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return report


@router.post("/{report_id}/coach")
def coach(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report or report.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    previous = db.scalars(
        select(Report)
        .where(Report.user_id == user.id, Report.id != report.id)
        .order_by(Report.created_at.desc())
        .limit(1)
    ).first()
    prev_data = {"domain_scores": previous.domain_scores} if previous else None
    return {"message": llm.coach_message(
        {"overall": report.overall, "risk": report.risk, "domain_scores": report.domain_scores},
        prev_data,
    )}


@router.post("/{report_id}/export")
def export_pdf(report_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate and return the PDF report."""
    report = db.get(Report, report_id)
    if not report or report.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    pdf = reporting.generate_report_pdf(
        {
            "overall": report.overall,
            "risk": report.risk,
            "confidence": report.confidence,
            "domain_scores": report.domain_scores,
            "explanations": report.explanations,
            "recommendations": report.recommendations,
            "doctor_summary": report.doctor_summary,
        },
        {"name": user.name},
    )
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="neurolens-report-{report.id}.pdf"'},
    )
