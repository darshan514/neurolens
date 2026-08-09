from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import ExamResult, ExamSession, MedicationLog, Report, User
from ..schemas import (
    ExamResultIn,
    ExamResultOut,
    ExamSessionIn,
    MedicationLogIn,
    MedicationLogOut,
    SessionOut,
)
from ..services.analysis import score_domain

router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: ExamSessionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = ExamSession(user_id=user.id, device=body.device, offline=body.offline)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(ExamSession)
        .where(ExamSession.user_id == user.id)
        .options(selectinload(ExamSession.results))
        .order_by(ExamSession.started_at.desc())
    ).all()


@router.post("/sessions/{session_id}/results", response_model=ExamResultOut)
def submit_result(
    session_id: int,
    body: ExamResultIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.get(ExamSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    # score server-side if the client only sent raw features
    result = ExamResult(
        session_id=session.id,
        domain=body.domain,
        score=body.score if body.score is not None else score_domain(body.domain, body.features)["score"],
        confidence=body.confidence,
        features=body.features,
        flags=body.flags,
        notes=body.notes,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


@router.post("/sessions/{session_id}/complete", response_model=SessionOut)
def complete_session(session_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ExamSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    session.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/medication", response_model=list[MedicationLogOut])
def list_meds(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(MedicationLog).where(MedicationLog.user_id == user.id).order_by(MedicationLog.created_at.desc())
    ).all()


@router.post("/medication", response_model=MedicationLogOut, status_code=status.HTTP_201_CREATED)
def log_med(body: MedicationLogIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = MedicationLog(user_id=user.id, taken=body.taken, domain_scores=body.domain_scores, note=body.note)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/medication/report")
def medication_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Medication effectiveness report: latest before/after pair + deltas."""
    logs = db.scalars(
        select(MedicationLog).where(MedicationLog.user_id == user.id).order_by(MedicationLog.created_at)
    ).all()
    before = next((l for l in reversed(logs) if not l.taken), None)
    after = next((l for l in reversed(logs) if l.taken), None)
    if not before or not after:
        return {"ok": False, "error": "Log at least one before and one after dose entry."}
    domains = sorted(set(before.domain_scores) | set(after.domain_scores))
    deltas = [
        {
            "domain": d,
            "before": round(before.domain_scores.get(d, 0)),
            "after": round(after.domain_scores.get(d, 0)),
            "delta": round(after.domain_scores.get(d, 0) - before.domain_scores.get(d, 0)),
        }
        for d in domains
    ]
    improved = sum(1 for x in deltas if x["delta"] > 0)
    declined = sum(1 for x in deltas if x["delta"] < 0)
    if improved > declined:
        verdict = "positive"
        summary = f"{improved} of {len(deltas)} domains improved after your dose."
    elif declined > improved:
        verdict = "limited"
        summary = f"{declined} of {len(deltas)} domains scored lower after your dose."
    else:
        verdict = "stable"
        summary = "Scores were roughly stable across your dose."
    return {
        "ok": True,
        "before_date": before.created_at.isoformat(),
        "after_date": after.created_at.isoformat(),
        "deltas": deltas,
        "verdict": verdict,
        "summary": summary,
    }
