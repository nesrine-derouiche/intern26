"""Schémas de la reconnaissance vocale (Speech-to-Text)."""

from pydantic import BaseModel


class TranscriptionResponse(BaseModel):
    """Réponse de transcription d'un audio (le texte reconnu)."""

    text: str
