from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

Role = str  # "patient" | "doctor" | "caregiver"


# ---------------------------------------------------------------- auth

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Role = "patient"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginIn(BaseModel):
    google_id_token: str
    name: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: Role
    height_cm: int
    preferred_language: str
    research_consent: bool

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = None
    height_cm: int | None = None
    preferred_language: str | None = None
    research_consent: bool | None = None


# ---------------------------------------------------------------- exams

class ExamResultIn(BaseModel):
    domain: str
    score: float = Field(ge=0, le=100)
    confidence: float = Field(default=80, ge=0, le=100)
    features: dict = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class ExamSessionIn(BaseModel):
    device: str = "unknown"
    offline: bool = False


class ExamResultOut(ExamResultIn):
    id: int
    session_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    started_at: datetime
    completed_at: datetime | None
    results: list[ExamResultOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------- reports

class ReportOut(BaseModel):
    id: int
    overall: float
    risk: str
    confidence: float
    domain_scores: dict
    explanations: list[str]
    recommendations: list[str]
    doctor_summary: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportIn(BaseModel):
    session_id: int | None = None
    domain_scores: dict | None = None  # allowed for direct submission


# ---------------------------------------------------------------- doctor

class PatientOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Role
    last_report_overall: float | None = None
    last_report_risk: str | None = None
    report_count: int = 0
    trend_8w: float | None = None


class MedicationLogIn(BaseModel):
    taken: bool
    domain_scores: dict = Field(default_factory=dict)
    note: str | None = None


class MedicationLogOut(MedicationLogIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


TokenOut.model_rebuild()
