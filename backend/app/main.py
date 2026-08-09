import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth, doctor, exams, models, notifications, reports, research
from .services.models import is_ml_ready

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "NeuroLens AI — digital neurological screening platform. "
        "Screening aid; does not diagnose any condition."
    ),
)

origins = json.loads(settings.cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Create tables in dev. Use Alembic migrations in production.
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "ml_ready": is_ml_ready(),
    }


app.include_router(auth.router)
app.include_router(exams.router)
app.include_router(reports.router)
app.include_router(doctor.router)
app.include_router(research.router)
app.include_router(notifications.router)
app.include_router(models.router)
