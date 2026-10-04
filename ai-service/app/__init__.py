"""Microservice Python d'entretien IA vocal pour la plateforme STEG Internship."""

from .config import get_settings
from .routes import api_router

__all__ = ["get_settings", "api_router"]
