from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Patient, Role, User
from app.security import hash_password


async def seed_demo() -> None:
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == settings.demo_email))
        if user is None:
            user = User(
                email=settings.demo_email,
                full_name=settings.demo_name,
                password_hash=hash_password(settings.demo_password),
                role=Role.clinician,
            )
            db.add(user)
            await db.flush()

        existing = await db.scalar(select(Patient).where(Patient.mrn == "DEMO-100"))
        if existing is None:
            db.add_all([
                Patient(
                    full_name="Replay Patient 100",
                    mrn="DEMO-100",
                    age=54,
                    notes="MIT-BIH record 100 — mostly normal",
                    consent=True,
                    risk_band="green",
                    clinician_id=user.id,
                ),
                Patient(
                    full_name="Replay Patient 119",
                    mrn="DEMO-119",
                    age=62,
                    notes="MIT-BIH record 119 — frequent V beats",
                    consent=True,
                    risk_band="amber",
                    clinician_id=user.id,
                ),
                Patient(
                    full_name="Replay Patient 208",
                    mrn="DEMO-208",
                    age=58,
                    notes="MIT-BIH record 208 — ventricular ectopy",
                    consent=True,
                    risk_band="orange",
                    clinician_id=user.id,
                ),
            ])

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

        home_patient = await db.scalar(select(Patient).where(Patient.mrn == settings.guest_patient_mrn))
        if home_patient is None:
            db.add(
                Patient(
                    full_name="Home monitoring",
                    mrn=settings.guest_patient_mrn,
                    age=None,
                    notes="Guest home path — MIT-BIH replay until AD8232 pairing ships",
                    consent=True,
                    risk_band="green",
                    clinician_id=guest.id,
                )
            )
        await db.commit()
