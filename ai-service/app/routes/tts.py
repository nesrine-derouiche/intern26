"""Route de synthèse vocale (Text-to-Speech).

``POST /api/tts/synthesize`` : reçoit un texte JSON et renvoie l'audio
synthétisé (MP3 via OpenAI/edge-tts, WAV via voix système) directement
consommable par le navigateur (``<audio>`` / ``Audio()``). Protégée par le
jeton de service : la clé ``TTS_API_KEY`` ne quitte jamais le serveur Python.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..core.security import require_service_token
from ..schemas.tts import SynthesizeRequest
from ..services import text_to_speech as tts_module
from ..services.text_to_speech import (
    TtsProviderError,
    TtsUnavailableError,
    TtsValidationError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])

_ALWAYS_AUTH = Depends(require_service_token)


def _service():
    """Service TTS résolu à l'appel (reconstruit par les tests si besoin)."""
    return tts_module.text_to_speech_service


@router.post(
    "/synthesize",
    response_model=None,
    summary="Transforme un texte en audio vocal",
    responses={
        200: {"content": {"audio/mpeg": {}, "audio/wav": {}}, "description": "Fichier audio."},
        400: {"description": "Texte invalide (vide ou trop long)."},
        401: {"description": "Jeton de service invalide."},
        502: {"description": "Le fournisseur TTS a refusé la requête."},
        503: {"description": "Aucun fournisseur TTS opérationnel."},
    },
)
async def synthesize_audio(
    request: SynthesizeRequest,
    _: None = _ALWAYS_AUTH,
) -> Response:
    """Synthétise le texte et renvoie l'audio généré."""
    try:
        # La synthèse est synchrone (HTTP vers le fournisseur) : on la déporte
        # dans un thread pour ne pas bloquer l'event loop.
        audio = await asyncio.to_thread(_service().synthesize, request.text)
    except TtsValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except TtsProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except TtsUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    logger.info(
        "[TTS] audio sent (%d bytes, %s, provider=%s)",
        len(audio.content),
        audio.media_type,
        _service().provider_name,
    )
    return Response(
        content=audio.content,
        media_type=audio.media_type,
        headers={
            "Content-Disposition": f'inline; filename="synthese.{audio.extension}"',
            "X-Audio-Format": audio.extension,
            "X-TTS-Provider": _service().provider_name,
        },
    )
