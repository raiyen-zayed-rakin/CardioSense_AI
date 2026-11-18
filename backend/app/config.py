from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent
MVP_ROOT = BACKEND_ROOT.parent
MODEL_DIR = MVP_ROOT / "cardiosense_beat_model"
DATA_DIR = BACKEND_ROOT / "data"
DB_PATH = DATA_DIR / "cardiosense.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CardioSense AI"
    api_prefix: str = "/v1"
    secret_key: str = "dev-change-me-cardiosense-hackathon"
    access_token_minutes: int = 60
    refresh_token_days: int = 14
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    database_url: str = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"
    model_dir: Path = MODEL_DIR
    mitdb_dir: Path = DATA_DIR / "mitdb"
    demo_email: str = "clinician@example.com"
    demo_password: str = "demo1234"
    demo_name: str = "Dr. Demo"
    guest_email: str = "guest@cardiosense.local"
    guest_name: str = "Home Guest"
    guest_patient_mrn: str = "HOME-100"
    guest_default_record: str = "100"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    groq_base_url: str = "https://api.groq.com/openai/v1"


settings = Settings()
DATA_DIR.mkdir(parents=True, exist_ok=True)
