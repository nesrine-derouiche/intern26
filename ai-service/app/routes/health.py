"""Route de santé du microservice d'entretien IA."""

from fastapi import APIRouter

from ..schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="État du service")
def health() -> HealthResponse:
    """Renvoie l'état du service (utilisé par le backend Node et les monitors)."""
    return HealthResponse(status="ok", service="ai-interview")
