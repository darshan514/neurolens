from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)  # None for Google SSO
    name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="patient")  # patient | doctor | caregiver
    height_cm: Mapped[int] = mapped_column(Integer, default=170)
    preferred_language: Mapped[str] = mapped_column(String(8), default="en")
    research_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["ExamSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class ExamSession(Base):
    """One screening session (a user runs several domain tests within it)."""

    __tablename__ = "exam_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    device: Mapped[str] = mapped_column(String(64), default="unknown")  # client metadata
    offline: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="sessions")
    results: Mapped[list["ExamResult"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ExamResult(Base):
    """A single domain measurement (voice, tap, spiral, …) with its raw features."""

    __tablename__ = "exam_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("exam_sessions.id"))
    domain: Mapped[str] = mapped_column(String(32), index=True)  # voice | tap | spiral | …
    score: Mapped[float] = mapped_column(Float)  # 0–100, higher = healthier
    confidence: Mapped[float] = mapped_column(Float, default=80.0)
    # raw measured features (jitter, shimmer, tremor_freq, …) as JSON
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    # feature keys outside the healthy range
    flags: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped[ExamSession] = relationship(back_populates="results")


class Report(Base):
    """Fused, explainable screening report (the multimodal risk estimate)."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    overall: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String(16))  # Low | Moderate | High
    confidence: Mapped[float] = mapped_column(Float)
    domain_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    explanations: Mapped[list] = mapped_column(JSON, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    doctor_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="reports")


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    taken: Mapped[bool] = mapped_column(Boolean)  # True = after dose, False = before
    domain_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    """User-facing alert (trend flag, reminder, family alert). FCM delivery
    hooks in here when push credentials are configured."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(24))  # trend | reminder | medication | family
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
