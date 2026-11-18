from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import AlertRow, Patient, User
from app.schemas import AlertOut, PatientCreate, PatientOut
from app.security import get_current_user

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientOut])
async def list_patients(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = await db.scalars(select(Patient).order_by(Patient.risk_band.desc(), Patient.id))
    return list(q)


@router.post("", response_model=PatientOut)
async def create_patient(
    body: PatientCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exists = await db.scalar(select(Patient).where(Patient.mrn == body.mrn))
    if exists:
        raise HTTPException(status_code=400, detail="MRN already exists")
    patient = Patient(
        full_name=body.full_name,
        mrn=body.mrn,
        age=body.age,
        notes=body.notes,
        consent=body.consent,
        clinician_id=user.id,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/alerts", response_model=list[AlertOut])
async def list_patient_alerts(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    rows = await db.scalars(
        select(AlertRow)
        .where(AlertRow.patient_id == patient_id)
        .order_by(AlertRow.id.desc())
        .limit(50)
    )
    return list(rows)
