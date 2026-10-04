"""Schémas Pydantic de la vérification de documents d'onboarding.

Contrat serveur-à-serveur (backend Node → microservice Python) :
``POST /api/documents/verify`` reçoit un fichier multipart accompagné du type
de document attendu et des informations du candidat (depuis le dossier du
candidat côté backend). La réponse est un résultat de vérification structuré :
statut, score de confiance, type détecté, contrôles, anomalies et résumé.

Le résultat ne contient AUCUNE donnée personnelle brute (ni numéro CIN, ni
contenu du document) : uniquement des conclusions binaires et des messages
génériques. Il reste consultable par un RH — la décision finale n'est jamais
automatisée à partir de ce résultat seul.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class VerdictStatus(str, Enum):
    """Statut global de la vérification d'un document."""

    VALID = "VALID"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REJECTED = "REJECTED"


class CandidateInfo(BaseModel):
    """Informations du candidat envoyées par le backend Node pour la cohérence.

    Seules des conclusions (booléens/issues) sont conservées dans le résultat ;
    ces champs ne sont jamais renvoyés dans la réponse et ne sont pas journalisés.
    """

    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[str] = None
    cin: Optional[str] = None


class DocumentChecks(BaseModel):
    """Contrôles automatiques effectués sur le document."""

    document_type_match: bool
    candidate_name_match: bool
    required_information_present: bool


class DocumentVerificationResponse(BaseModel):
    """Résultat structuré de la vérification d'un document."""

    status: VerdictStatus
    confidence: int = Field(ge=0, le=100)
    document_type: str
    checks: DocumentChecks
    issues: List[str] = Field(default_factory=list)
    summary: str
