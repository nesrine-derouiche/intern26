"""Route de reconnaissance vocale (Speech-to-Text).

``POST /api/stt/transcribe`` : reçoit un fichier audio (multipart) et renvoie
la transcription texte ``{"text": "..."}``. Protégée par le jeton de service :
le frontend n'appelle jamais Python directement (transit par le backend Node).
"""

import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..core.security import require_service_token
from ..schemas.stt import TranscriptionResponse
from ..services.speech_to_text import (
    SttProviderError,
    SttUnavailableError,
    SttValidationError,
    speech_to_text_service,
)

router = APIRouter(prefix="/api/stt", tags=["stt"])

_ALWAYS_AUTH = Depends(require_service_token)


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcrit un fichier audio en texte",
)
async def transcribe_audio(
    file: UploadFile = File(...),
    _: None = _ALWAYS_AUTH,
) -> TranscriptionResponse:
    """Transcrit l'audio envoyé et renvoie le texte reconnu."""
    audio = await file.read()

    try:
        # La transcription est synchrone (HTTP vers le fournisseur) :
        # on la déporte dans un thread pour ne pas bloquer l'event loop.
        text = await asyncio.to_thread(
            speech_to_text_service.transcribe,
            audio,
            file.filename or "audio.webm",
            file.content_type,
        )
    except SttValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SttProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except SttUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    return TranscriptionResponse(text=text)
