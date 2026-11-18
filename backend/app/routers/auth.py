from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Patient, Role, User
from app.schemas import GuestSessionOut, LoginIn, RefreshIn, RegisterIn, TokenPair, UserOut
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
async def register(body: RegisterIn, db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User).where(User.email == body.email.lower()))
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
async def login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token, "refresh")
    user = await db.scalar(select(User).where(User.id == int(payload["sub"])))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/guest", response_model=GuestSessionOut)
async def guest_session(db: AsyncSession = Depends(get_db)):
    """Anonymous home-monitoring session — no signup required."""
    guest = await db.scalar(select(User).where(User.email == settings.guest_email))
    if guest is None:
        guest = User(
            email=settings.guest_email,
            full_name=settings.guest_name,
            password_hash=hash_password("guest-disabled-no-password-login"),
            role=Role.patient,
        )
        db.add(guest)
        await db.flush()

    patient = await db.scalar(select(Patient).where(Patient.mrn == settings.guest_patient_mrn))
    if patient is None:
        patient = Patient(
            full_name="Home monitoring",
            mrn=settings.guest_patient_mrn,
            notes="Guest home path — MIT-BIH replay until AD8232 pairing ships",
            consent=True,
            risk_band="green",
            clinician_id=guest.id,
        )
        db.add(patient)
        await db.flush()

    await db.commit()
    await db.refresh(patient)

    return GuestSessionOut(
        access_token=create_access_token(guest.id, guest.role.value),
        refresh_token=create_refresh_token(guest.id),
        patient_id=patient.id,
        record=settings.guest_default_record,
        mode="guest",
    )
