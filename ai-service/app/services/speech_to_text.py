"""Service de reconnaissance vocale (Speech-to-Text).

Abstraction ``SpeechToTextService`` permettant de changer de fournisseur STT
sans toucher aux routes ni au moteur d'entretien :

- ``OpenAiWhisperSttProvider`` : fournisseur réel (API OpenAI ``whisper-1``),
  clé lue depuis ``STT_API_KEY`` (.env) — jamais en dur dans le code ;
- ``MockSttProvider`` : fallback local (aucune clé) pour le développement et
  les tests, renvoie une transcription simulée et identifiable.

Le service reçoit l'audio (octets + nom + type MIME), vérifie le format,
convertit si nécessaire (ffmpeg, s'il est disponible), délègue la transcription
au fournisseur, puis renvoie le texte. Les erreurs sont normalisées :

- ``SttValidationError``  -> HTTP 400 (audio vide / format non pris en charge) ;
- ``SttProviderError``    -> HTTP 502 (fournisseur refuse la clé ou l'audio) ;
- ``SttUnavailableError`` -> HTTP 503 (pas de fournisseur configuré / injoignable).

Sélection du fournisseur (variable ``STT_PROVIDER``, défaut ``auto``) :

- ``auto``   -> OpenAI si ``STT_API_KEY`` est renseignée, sinon Mock ;
- ``openai`` -> force OpenAI (erreur 503 si la clé manque) ;
- ``mock``   -> force le Mock (utile pour tester le pipeline hors ligne).
"""

import io
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from typing import Optional, Protocol

import httpx

logger = logging.getLogger(__name__)


# Formats d'audio acceptés par l'API OpenAI Whisper (un sous-ensemble raisonnable).
OPENAI_SUPPORTED_EXTENSIONS = {
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".oga",
    ".ogg",
    ".wav",
    ".webm",
}

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # Limite Whisper : 25 Mo.

OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions"


# ────────────────────────────────── Erreurs ──────────────────────────────────


class SttValidationError(Exception):
    """Audio invalide (vide, trop volumineux, format non pris en charge)."""


class SttProviderError(Exception):
    """Le fournisseur STT a refusé la requête (clé invalide, audio rejeté…)."""


class SttUnavailableError(Exception):
    """Aucun fournisseur STT opérationnel (clé manquante ou service injoignable)."""


# ────────────────────────────────── Fournisseurs ─────────────────────────────


class SttProvider(Protocol):
    """Contrat d'un fournisseur de transcription vocale."""

    def transcribe(self, audio: bytes, filename: str) -> str:
        """Transcrit l'audio et renvoie le texte reconnu (lève en cas d'erreur)."""
        ...


class OpenAiWhisperSttProvider:
    """Fournisseur réel basé sur l'API OpenAI ``whisper-1``."""

    name = "openai"

    def __init__(self, api_key: str, language: str = "fr", timeout: float = 60.0):
        self._api_key = api_key
        self._language = language
        self._timeout = timeout

    def transcribe(self, audio: bytes, filename: str) -> str:
        files = {"file": (filename, audio, self._mime(filename))}
        data = {"model": "whisper-1", "response_format": "json"}
        if self._language:
            data["language"] = self._language

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(
                    OPENAI_TRANSCRIPTIONS_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    files=files,
                    data=data,
                )
        except httpx.TimeoutException as exc:
            raise SttUnavailableError(
                "Le fournisseur STT a mis trop de temps à répondre."
            ) from exc
        except httpx.HTTPError as exc:
            raise SttUnavailableError(
                "Le fournisseur STT est injoignable. Réessayez dans quelques instants."
            ) from exc

        if response.status_code == 200:
            payload = response.json()
            text = (payload.get("text") or "").strip()
            if not text:
                raise SttProviderError("Le fournisseur STT a renvoyé une transcription vide.")
            return text

        detail = self._extract_detail(response)
        if response.status_code in (401, 403):
            raise SttProviderError(
                "Authentification du fournisseur STT refusée (clé STT_API_KEY invalide)."
            )
        if response.status_code == 400:
            raise SttValidationError(
                detail or "Le fournisseur STT a rejeté l'audio (format ou contenu invalide)."
            )
        raise SttUnavailableError(
            detail or "Le fournisseur STT a renvoyé une erreur temporaire."
        )

    @staticmethod
    def _mime(filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()
        return {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".ogg": "audio/ogg",
            ".webm": "audio/webm",
            ".flac": "audio/flac",
        }.get(ext, "application/octet-stream")

    @staticmethod
    def _extract_detail(response: httpx.Response) -> str:
        try:
            error = response.json().get("error") or {}
            return error.get("message") or ""
        except ValueError:
            return response.text[:300]


class MockSttProvider:
    """Fournisseur de repli : ne fait aucun appel réseau.

    Renvoie une transcription simulée et identifiable, afin de valider le
    pipeline (upload -> endpoint -> texte) sans clé API.
    """

    name = "mock"

    def transcribe(self, audio: bytes, filename: str) -> str:
        logger.info("[STT] Fournisseur MOCK utilisé (aucune STT_API_KEY configurée).")
        return (
            "Je suis motivé par ce stage et j'ai déjà réalisé plusieurs "
            "projets en équipe."
        )


# ─────────────────────────── Conversion (si nécessaire) ──────────────────────


def _convert_to_wav(audio: bytes, source_ext: str) -> Optional[bytes]:
    """Convertit l'audio en WAV 16 kHz mono via ffmpeg (s'il est disponible)."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None

    try:
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=source_ext) as src, tempfile.NamedTemporaryFile(
            suffix=".wav"
        ) as dst:
            src.write(audio)
            src.flush()
            subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    src.name,
                    "-ar",
                    "16000",
                    "-ac",
                    "1",
                    dst.name,
                ],
                check=True,
                capture_output=True,
            )
            with open(dst.name, "rb") as f:
                return f.read()
    except (OSError, subprocess.CalledProcessError) as exc:
        logger.warning("[STT] Conversion ffmpeg impossible : %s", exc)
        return None


# ──────────────────────────────── Service ────────────────────────────────────


class SpeechToTextService:
    """Point d'entrée de la reconnaissance vocale.

    ``transcribe`` reçoit l'audio (octets), le convertit si nécessaire, le
    transmet au fournisseur sélectionné et renvoie le texte transcrit.
    """

    def __init__(self, provider: SttProvider, supported_extensions):
        self._provider = provider
        self._supported_extensions = supported_extensions

    @property
    def provider_name(self) -> str:
        return getattr(self._provider, "name", "unknown")

    def transcribe(
        self,
        audio: bytes,
        filename: str = "audio.webm",
        content_type: Optional[str] = None,
    ) -> str:
        """Transcrit l'audio en texte. Lève une des erreurs STT normalisées."""
        # 1. Validation du flux audio.
        if not audio:
            raise SttValidationError("Le fichier audio est vide.")
        if len(audio) > MAX_AUDIO_BYTES:
            raise SttValidationError(
                f"Fichier audio trop volumineux ({len(audio) / 1024 / 1024:.1f} Mo, "
                f"max {MAX_AUDIO_BYTES // 1024 // 1024} Mo)."
            )

        filename = filename or "audio.webm"
        ext = os.path.splitext(filename)[1].lower()

        # 2. Conversion si le format n'est pas pris en charge par le fournisseur.
        if ext not in self._supported_extensions:
            converted = _convert_to_wav(audio, ext)
            if converted is not None:
                audio, ext = converted, ".wav"
            else:
                raise SttValidationError(
                    f"Format audio non pris en charge ({filename or ext}). "
                    "Formats acceptés : "
                    + ", ".join(sorted(self._supported_extensions))
                    + "."
                )

        # 3. Transcription par le fournisseur.
        return self._provider.transcribe(audio, filename)


# ─────────────────────────────── Construction ────────────────────────────────


def build_stt_service(settings=None) -> SpeechToTextService:
    """Construit le service STT en fonction de la configuration (.env)."""
    from ..config import get_settings

    settings = settings or get_settings()
    provider_name = (settings.stt_provider or "auto").strip().lower()
    api_key = (settings.stt_api_key or "").strip()

    if provider_name == "mock":
        provider = MockSttProvider()
    elif provider_name == "openai":
        if not api_key:
            raise SttUnavailableError(
                "Fournisseur STT 'openai' requis mais STT_API_KEY absente (.env)."
            )
        provider = OpenAiWhisperSttProvider(api_key=api_key)
    else:  # auto
        provider = (
            OpenAiWhisperSttProvider(api_key=api_key)
            if api_key
            else MockSttProvider()
        )

    # Les formats supportés dépendent du fournisseur.
    if isinstance(provider, OpenAiWhisperSttProvider):
        supported = OPENAI_SUPPORTED_EXTENSIONS
    else:
        # Le Mock accepte n'importe quel contenu : on autorise les formats
        # courants pour ne pas bloquer les tests hors ligne.
        supported = OPENAI_SUPPORTED_EXTENSIONS

    return SpeechToTextService(provider=provider, supported_extensions=supported)


# Instance partagée du service (résolue à l'import).
speech_to_text_service = build_stt_service()
