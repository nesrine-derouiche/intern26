"""Schéma de la réponse ``GET /health``."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """État du microservice d'entretien IA."""

    status: str
    service: str
