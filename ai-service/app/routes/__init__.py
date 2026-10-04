"""Agrégation des routeurs de l'API du microservice."""

from fastapi import APIRouter

from .documents import router as documents_router
from .health import router as health_router
from .interviews import router as interviews_router
from .stt import router as stt_router
from .tts import router as tts_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(interviews_router)
api_router.include_router(stt_router)
api_router.include_router(tts_router)
api_router.include_router(documents_router)

__all__ = ["api_router"]
