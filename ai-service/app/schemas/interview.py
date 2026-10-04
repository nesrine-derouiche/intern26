"""Schémas Pydantic du domaine « entretien IA vocal ».

Le backend Node envoie un contexte d'offre (textuel) : technologies et
compétences sont transmises comme listes de chaînes. Les réponses du candidat
sont envoyées avec leur numéro de question pour l'évaluation.
"""

from typing import Optional

from pydantic import BaseModel, Field


class OffreContext(BaseModel):
    titre: Optional[str] = None
    departement_nom: Optional[str] = None
    description: Optional[str] = None
    missions: Optional[str] = None
    niveau: Optional[str] = None
    localisation: Optional[str] = None
    duree: Optional[int] = None
    technologies: list[str] = Field(default_factory=list)
    competences: list[str] = Field(default_factory=list)


class InterviewCreateRequest(BaseModel):
    candidature_id: str
    offre: OffreContext = Field(default_factory=OffreContext)
    cv: Optional[str] = None


class InterviewStartRequest(BaseModel):
    offre: OffreContext = Field(default_factory=OffreContext)


class InterviewAnswerRequest(BaseModel):
    question_number: int
    answer: str
