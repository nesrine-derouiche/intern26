"""Sécurité du microservice : authentification des appels serveur-à-serveur.

Le backend Node.js appelle ce service en envoyant l'en-tête ``X-Service-Token``.
Le jeton attendu est ``SERVICE_TOKEN`` (variable d'environnement), qui doit être
identique à ``PYTHON_SERVICE_TOKEN`` côté Node. La comparaison est faite en temps
constant (``secrets.compare_digest``) pour éviter les attaques par timing.
"""

import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from ..config import get_settings


def require_service_token(x_service_token: Optional[str] = Header(default=None)) -> None:
    """Dépendance FastAPI : refuse l'appel si le jeton de service est invalide."""
    settings = get_settings()
    expected = settings.service_token

    if not expected or not x_service_token or not secrets.compare_digest(x_service_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton de service invalide.",
        )


# Dépendance réutilisable dans les routes.
service_auth = Depends(require_service_token)
