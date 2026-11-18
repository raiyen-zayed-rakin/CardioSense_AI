from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import Role


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: Role = Role.clinician


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: Role

    model_config = {"from_attributes": True}


class PatientCreate(BaseModel):
    full_name: str
    mrn: str
    age: int | None = None
    notes: str | None = None
    consent: bool = True


class PatientOut(BaseModel):
    id: int
    full_name: str
    mrn: str
    age: int | None
    notes: str | None
    consent: bool
    risk_band: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReplayStartIn(BaseModel):
    patient_id: int
    record: str = "100"
    speed: float = Field(default=1.0, ge=0.25, le=8.0)


class ReplayStartOut(BaseModel):
    session_id: int
    record: str
    fs: int
    n_samples: int
    duration_s: float
    ws_path: str


class HealthOut(BaseModel):
    status: str
    model_ready: bool
    model_version: str | None = None


class GuestSessionOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    patient_id: int
    record: str
    mode: str = "guest"


class AlertOut(BaseModel):
    id: int
    session_id: int
    patient_id: int
    rule_id: str
    tier: str
    title: str
    message: str
    status: str
    t: float
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
