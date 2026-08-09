from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import (
    GoogleLoginIn,
    LoginIn,
    ProfileUpdate,
    RegisterIn,
    TokenOut,
    UserOut,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_for(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    exists = db.scalar(select(User).where(User.email == body.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_for(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _token_for(user)


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleLoginIn, db: Session = Depends(get_db)):
    """Google SSO: verify the ID token with google-auth and upsert the user."""
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        info = google_id_token.verify_oauth2_token(
            body.google_id_token, google_requests.Request()
        )
    except Exception:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid Google credential"
        )

    email = (info.get("email") or "").lower()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google account has no email")
    name = body.name or info.get("name") or "Google User"
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(email=email, name=name, role="patient", hashed_password=None)
        db.add(user)
        db.commit()
        db.refresh(user)
    return _token_for(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name is not None:
        user.name = body.name
    if body.height_cm is not None:
        user.height_cm = body.height_cm
    if body.preferred_language is not None:
        user.preferred_language = body.preferred_language
    if body.research_consent is not None:
        user.research_consent = body.research_consent
    db.commit()
    db.refresh(user)
    return user
