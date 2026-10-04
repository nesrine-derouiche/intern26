"""Routes d'entretien IA vocal — appelées par le backend Node uniquement.

Toutes les routes sont protégées par le jeton de service (X-Service-Token).
Le frontend Angular ne parle jamais directement à ces routes.

L'entretien est CONVERSATIONNEL : ``start`` renvoie la première question, chaque
``answer`` renvoie la question suivante (adaptée à la réponse), ``complete``
finalise l'évaluation.
"""

from typing import Optional

from fastapi import APIRouter, Depends, status

from ..core.security import require_service_token
from ..schemas.interview import (
    InterviewAnswerRequest,
    InterviewCreateRequest,
    InterviewStartRequest,
)
from ..services import interview_store

router = APIRouter(prefix="/api/v1/interviews", tags=["interviews"])

_ALWAYS_AUTH = Depends(require_service_token)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_interview(
    payload: InterviewCreateRequest,
    _: None = _ALWAYS_AUTH,
):
    """Crée un entretien IA vocal pour une candidature (statut CREATED)."""
    return interview_store.create(
        payload.candidature_id,
        payload.offre.model_dump(),
        payload.cv,
    )


@router.get("/{session_id}")
def get_interview(
    session_id: str,
    _: None = _ALWAYS_AUTH,
):
    """Détail d'un entretien (statut, questions déjà posées)."""
    return interview_store.get(session_id)


@router.post("/{session_id}/start")
def start_interview(
    session_id: str,
    payload: Optional[InterviewStartRequest] = None,
    _: None = _ALWAYS_AUTH,
):
    """Démarre l'entretien : renvoie la première question (Présentation)."""
    offre = payload.offre.model_dump() if payload else {}
    return interview_store.start(session_id, offre)


@router.post("/{session_id}/answer")
def answer_interview(
    session_id: str,
    payload: InterviewAnswerRequest,
    _: None = _ALWAYS_AUTH,
):
    """Enregistre une réponse et renvoie la question suivante (ou ``done``)."""
    return interview_store.answer(session_id, payload.question_number, payload.answer)


@router.post("/{session_id}/complete")
def complete_interview(
    session_id: str,
    _: None = _ALWAYS_AUTH,
):
    """Termine l'entretien : le moteur évalue les réponses et renvoie le rapport."""
    return interview_store.complete(session_id)


@router.get("/{session_id}/report")
def get_report(
    session_id: str,
    _: None = _ALWAYS_AUTH,
):
    """Rapport d'évaluation d'un entretien terminé."""
    return interview_store.report(session_id)
