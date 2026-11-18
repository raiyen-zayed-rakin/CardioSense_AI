from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.ml_service import inference
from app.routers import assistant, auth, demo, patients
from app.schemas import HealthOut
from app.seed import seed_demo


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await seed_demo()
    try:
        inference.load()
    except Exception as exc:  # noqa: BLE001
        print("Model load warning:", exc)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(patients.router, prefix=settings.api_prefix)
app.include_router(demo.router, prefix=settings.api_prefix)
app.include_router(assistant.router, prefix=settings.api_prefix)


@app.get("/health", response_model=HealthOut)
async def health():
    return HealthOut(
        status="ok",
        model_ready=inference.ready,
        model_version=inference.state.version,
    )
