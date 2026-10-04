"""Route de vérification de documents d'onboarding.

``POST /api/documents/verify`` : reçoit un document (multipart) + le type de
document attendu (``CV``, ``CIN``, ``DEMANDE_STAGE``, ``LETTRE_AFFECTATION``)
et les informations du candidat (champ ``candidate`` au format JSON) ; renvoie
un résultat de vérification structuré (statut, confiance, contrôles, anomalies,
résumé). Protégée par le jeton de service : le frontend n'appelle jamais Python
directement (transit par le backend Node).

Aucune décision finale n'est automatisée à partir de ce résultat : il est
destiné aux RH, qui conservent la validation manuelle.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from ..core.security import require_service_token
from ..schemas.documents import (
    CandidateInfo,
    DocumentVerificationResponse,
)
from ..services import document_verification as dv_module
from ..services.document_verification import (
    DocumentUnavailableError,
    DocumentValidationError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

_ALWAYS_AUTH = Depends(require_service_token)


def _service():
    """Service de vérification résolu à l'appel (reconstruit par les tests si besoin)."""
    return dv_module.document_verification_service


@router.post(
    "/verify",
    response_model=DocumentVerificationResponse,
    summary="Vérifie un document d'onboarding (CV, CIN, demande, lettre)",
    responses={
        200: {"description": "Résultat structuré de la vérification."},
        400: {"description": "Fichier ou métadonnées invalides."},
        401: {"description": "Jeton de service invalide."},
        503: {"description": "Service de vérification indisponible (ex. OCR requis)."},
    },
)
async def verify_document(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    candidature_id: str = Form(""),
    candidate: str = Form("{}"),
    _: None = _ALWAYS_AUTH,
) -> DocumentVerificationResponse:
    """Analyse le document et renvoie le résultat de vérification structuré."""
    try:
        candidate_info = CandidateInfo.model_validate_json(candidate)
    except (ValidationError, json.JSONDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le champ « candidate » doit être un objet JSON valide "
            "(nom, prenom, email, cin).",
        ) from None

    content = await file.read()

    try:
        # L'extraction et l'analyse sont synchrones (lecture/parse de fichier) :
        # on les déporte dans un thread pour ne pas bloquer l'event loop.
        result = await asyncio.to_thread(
            _service().verify_document,
            content,
            file.filename,
            document_type.strip().upper(),
            candidate_info,
            candidature_id,
        )
    except DocumentValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    return result
