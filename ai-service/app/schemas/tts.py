"""Schémas de la synthèse vocale (Text-to-Speech).

La validation fine (texte vide, trop long) est assurée par le service
``TextToSpeechService`` afin d'obtenir des messages d'erreur cohérents (400).
"""

from pydantic import BaseModel


class SynthesizeRequest(BaseModel):
    """Requête de synthèse : le texte à transformer en voix."""

    text: str
