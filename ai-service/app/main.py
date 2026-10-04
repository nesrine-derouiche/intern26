"""Application FastAPI du microservice d'entretien IA.

Point d'entrée : ``uvicorn app.main:app --reload --port 8001``.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import api_router

# Logs applicatifs visibles (dont les balises [TTS] / [STT] demandées).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def create_app() -> FastAPI:
    """Construit l'application avec CORS et les routes du service."""
    settings = get_settings()

    app = FastAPI(
        title="AI Interview Service",
        description=(
            "Microservice Python d'entretien IA vocal pour la plateforme "
            "STEG Internship (backend Node.js/Express + frontends Angular)."
        ),
        version="0.1.0",
    )

    # CORS : uniquement les origines locales nécessaires (frontends Angular
    # et backend Node). Aucune origine "wildcard".
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    return app


app = create_app()
