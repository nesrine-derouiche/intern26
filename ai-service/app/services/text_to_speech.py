"""Service de synthèse vocale (Text-to-Speech).

Abstraction ``TextToSpeechService`` permettant de changer de fournisseur TTS
sans toucher aux routes ni au moteur d'entretien. La chaîne ``auto`` ne
« fait jamais semblant » : elle essaie les fournisseurs réels dans l'ordre et
renvoie une erreur claire (503) si aucun n'est disponible — pas de bip de
démonstration en production.

Fournisseurs :

- ``OpenAiTtsProvider`` : API OpenAI ``/v1/audio/speech`` (modèle ``tts-1``),
  clé lue depuis ``TTS_API_KEY`` (.env) ; voix naturelle ``nova`` par défaut ;
- ``EdgeTtsProvider`` : ``edge-tts`` (voix neuronales Microsoft), gratuit et
  sans clé, nécessite un accès réseau ; voix française par défaut
  ``fr-FR-DeniseNeural`` (configurable via ``TTS_VOICE``) ;
- ``SystemTtsProvider`` : voix système hors ligne — ``say`` (macOS) ou
  ``espeak-ng`` (Linux) — aucun appel réseau ;
- ``MockTtsProvider`` : réservé au mode explicite ``TTS_PROVIDER=mock``
  (développement hors ligne / tests) ; génère un vrai WAV audible mais qui
  n'est PAS une voix.

Le service reçoit le texte, le valide (non vide, longueur raisonnable), le
transmet au fournisseur et renvoie l'audio sous forme de ``TtsAudio``
(octets + type MIME + extension). Les erreurs sont normalisées :

- ``TtsValidationError``   -> HTTP 400 (texte vide ou trop long) ;
- ``TtsProviderError``     -> HTTP 502 (fournisseur refuse le texte / audio vide) ;
- ``TtsUnavailableError``  -> HTTP 503 (aucun fournisseur réel / injoignable).

La clé API n'est jamais exposée : le frontend appelle le backend Node, qui
transmet au microservice Python (jeton de service), qui détient la clé.

Sélection du fournisseur (variable ``TTS_PROVIDER``, défaut ``auto``) :

- ``auto``   -> OpenAI si ``TTS_API_KEY`` renseignée, sinon edge-tts, sinon
  voix système, sinon erreur 503 explicite ;
- ``openai`` -> force OpenAI (erreur 503 si la clé manque) ;
- ``edge``   -> force edge-tts (erreur 503 s'il n'est pas installé) ;
- ``system`` -> force la voix système (say / espeak-ng) ;
- ``mock``   -> force le Mock (développement / tests uniquement).
"""

import asyncio
import io
import logging
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)


# Texte maximum synthétisable (les fournisseurs limitent fortement la longueur).
MAX_TEXT_CHARS = 1000

OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech"

# Voix françaises par défaut (edge-tts / voix système).
DEFAULT_EDGE_VOICE = "fr-FR-DeniseNeural"
DEFAULT_SYSTEM_VOICE = "Thomas"


# ────────────────────────────────── Erreurs ──────────────────────────────────


class TtsValidationError(Exception):
    """Texte invalide (vide, trop long…)."""


class TtsProviderError(Exception):
    """Le fournisseur TTS a refusé la requête (clé invalide, texte rejeté…)."""


class TtsUnavailableError(Exception):
    """Aucun fournisseur TTS opérationnel (clé manquante ou service injoignable)."""


# ────────────────────────────────── Audio ────────────────────────────────────


@dataclass(frozen=True)
class TtsAudio:
    """Résultat de synthèse : l'audio prêt à être renvoyé au navigateur."""

    content: bytes
    media_type: str
    extension: str


# ────────────────────────────────── Fournisseurs ─────────────────────────────


class TtsProvider(Protocol):
    """Contrat d'un fournisseur de synthèse vocale."""

    name: str

    def synthesize(self, text: str) -> TtsAudio:
        """Génère l'audio du texte et le renvoie (lève en cas d'erreur)."""
        ...


class OpenAiTtsProvider:
    """Fournisseur réel basé sur l'API OpenAI ``/v1/audio/speech``.

    Voix naturelles disponibles (``nova`` = défaut, féminine, naturelle).
    """

    name = "openai"

    def __init__(self, api_key: str, voice: str = "nova", timeout: float = 60.0):
        self._api_key = api_key
        self._voice = voice
        self._timeout = timeout

    def synthesize(self, text: str) -> TtsAudio:
        data = {
            "model": "tts-1",
            "input": text,
            "voice": self._voice,
            "response_format": "mp3",
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                response = client.post(
                    OPENAI_SPEECH_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=data,
                )
        except httpx.TimeoutException as exc:
            raise TtsUnavailableError(
                "Le fournisseur TTS a mis trop de temps à répondre."
            ) from exc
        except httpx.HTTPError as exc:
            raise TtsUnavailableError(
                "Le fournisseur TTS est injoignable. Réessayez dans quelques instants."
            ) from exc

        if response.status_code == 200:
            content = response.content
            if not content:
                raise TtsProviderError("Le fournisseur TTS a renvoyé un audio vide.")
            return TtsAudio(content=content, media_type="audio/mpeg", extension="mp3")

        detail = self._extract_detail(response)
        if response.status_code in (401, 403):
            raise TtsProviderError(
                "Authentification du fournisseur TTS refusée (clé TTS_API_KEY invalide)."
            )
        if response.status_code == 400:
            raise TtsValidationError(
                detail or "Le fournisseur TTS a rejeté le texte (format ou longueur invalide)."
            )
        raise TtsUnavailableError(
            detail or "Le fournisseur TTS a renvoyé une erreur temporaire."
        )

    @staticmethod
    def _extract_detail(response: httpx.Response) -> str:
        try:
            error = response.json().get("error") or {}
            return error.get("message") or ""
        except ValueError:
            return response.text[:300]


class EdgeTtsProvider:
    """Fournisseur réel basé sur ``edge-tts`` (voix neuronales Microsoft).

    Gratuit, sans clé API, nécessite ``pip install edge-tts`` et un accès
    réseau. Produit un MP3 réellement parlant (voix française par défaut).
    """

    name = "edge"

    def __init__(self, voice: str = DEFAULT_EDGE_VOICE, timeout: float = 30.0):
        self._voice = voice
        self._timeout = timeout

    def synthesize(self, text: str) -> TtsAudio:
        try:
            import edge_tts
        except ImportError as exc:
            raise TtsUnavailableError(
                "Le fournisseur TTS 'edge' est requis mais edge-tts n'est pas installé "
                "(pip install edge-tts)."
            ) from exc

        async def _generate() -> bytes:
            communicate = edge_tts.Communicate(text, voice=self._voice)
            buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    buffer.write(chunk.get("data") or b"")
            return buffer.getvalue()

        try:
            content = asyncio.run(asyncio.wait_for(_generate(), timeout=self._timeout))
        except asyncio.TimeoutError as exc:
            raise TtsUnavailableError(
                "Le fournisseur TTS (edge) a mis trop de temps à répondre."
            ) from exc
        except TtsUnavailableError:
            raise
        except Exception as exc:
            raise TtsUnavailableError(
                "Le fournisseur TTS (edge) est injoignable. Vérifiez la connexion réseau."
            ) from exc

        if not content:
            raise TtsProviderError("Le fournisseur TTS (edge) a renvoyé un audio vide.")
        return TtsAudio(content=content, media_type="audio/mpeg", extension="mp3")


class SystemTtsProvider:
    """Voix système hors ligne : ``say`` (macOS) ou ``espeak-ng`` (Linux).

    Aucun appel réseau. Produit un WAV réellement parlant.
    """

    name = "system"

    def __init__(self, voice: str = DEFAULT_SYSTEM_VOICE, timeout: float = 30.0):
        self._voice = voice or ""
        self._timeout = timeout

    @staticmethod
    def available() -> bool:
        """Un moteur de voix système est-il utilisable ?"""
        if sys.platform == "darwin" and shutil.which("say"):
            return True
        return bool(shutil.which("espeak-ng") or shutil.which("espeak"))

    def synthesize(self, text: str) -> TtsAudio:
        if sys.platform == "darwin" and shutil.which("say"):
            return self._macos_say(text)
        if shutil.which("espeak-ng"):
            return self._espeak(text, cmd="espeak-ng")
        if shutil.which("espeak"):
            return self._espeak(text, cmd="espeak")
        raise TtsUnavailableError(
            "Aucune voix système disponible (ni `say`, ni `espeak-ng`)."
        )

    def _macos_say(self, text: str) -> TtsAudio:
        tmp_path = tempfile.mktemp(suffix=".wav")
        voice_args = ["-v", self._voice] if self._voice else []
        try:
            proc = subprocess.run(
                [
                    "say",
                    *voice_args,
                    "--data-format=LEI16@22050",
                    "-o",
                    tmp_path,
                    text,
                ],
                capture_output=True,
                text=True,
                timeout=self._timeout,
            )
            if proc.returncode != 0:
                raise TtsUnavailableError(
                    f"La voix système a échoué : {(proc.stderr or '').strip()[:200]}"
                )
            with open(tmp_path, "rb") as fh:
                content = fh.read()
            if not content:
                raise TtsProviderError("La voix système a renvoyé un audio vide.")
            return TtsAudio(content=content, media_type="audio/wav", extension="wav")
        except subprocess.TimeoutExpired as exc:
            raise TtsUnavailableError(
                "La voix système a mis trop de temps à répondre."
            ) from exc
        finally:
            try:
                import os

                os.unlink(tmp_path)
            except OSError:
                pass

    def _espeak(self, text: str, cmd: str) -> TtsAudio:
        tmp_path = tempfile.mktemp(suffix=".wav")
        try:
            proc = subprocess.run(
                [cmd, "-v", "fr", "-w", tmp_path, text],
                capture_output=True,
                text=True,
                timeout=self._timeout,
            )
            if proc.returncode != 0:
                raise TtsUnavailableError(
                    f"La voix système (espeak) a échoué : {(proc.stderr or '').strip()[:200]}"
                )
            with open(tmp_path, "rb") as fh:
                content = fh.read()
            if not content:
                raise TtsProviderError("La voix système a renvoyé un audio vide.")
            return TtsAudio(content=content, media_type="audio/wav", extension="wav")
        except subprocess.TimeoutExpired as exc:
            raise TtsUnavailableError(
                "La voix système a mis trop de temps à répondre."
            ) from exc
        finally:
            try:
                import os

                os.unlink(tmp_path)
            except OSError:
                pass


class MockTtsProvider:
    """Fournisseur de repli : ne fait aucun appel réseau.

    Génère un vrai fichier WAV (sinus modulé) audible par le navigateur.
    **N'est PAS une voix** : réservé au mode explicite ``TTS_PROVIDER=mock``
    (développement hors ligne / tests unitaires).
    """

    name = "mock"

    def synthesize(self, text: str) -> TtsAudio:
        logger.warning(
            "[TTS] Fournisseur MOCK utilisé (mode explicite, aucun vrai moteur de voix)."
        )
        content = _make_audio_for_text(text)
        return TtsAudio(content=content, media_type="audio/wav", extension="wav")


# ─────────────────────────────── Audio de test ───────────────────────────────


def _make_audio_for_text(text: str) -> bytes:
    """Génère un WAV mono 22,05 kHz audible (durée proportionnelle au texte)."""
    sample_rate = 22050
    words = len(text.split()) or 1
    duration_s = min(max(0.5, words * 0.18), 10.0)
    n_frames = int(sample_rate * duration_s)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = []
        for i in range(n_frames):
            t = i / sample_rate
            # Note modulée pour rendre l'audio audible et non monotone.
            freq = 220.0 + 80.0 * math.sin(2 * math.pi * 2.0 * t)
            envelope = 0.6 + 0.4 * math.sin(2 * math.pi * 1.5 * t)
            sample = int(6000 * envelope * math.sin(2 * math.pi * freq * t))
            frames.append(struct.pack("<h", max(-32768, min(32767, sample))))
        wav.writeframes(b"".join(frames))
    return buffer.getvalue()


# ──────────────────────────────── Service ────────────────────────────────────


class TextToSpeechService:
    """Point d'entrée de la synthèse vocale.

    ``synthesize`` reçoit le texte, le valide, le transmet au fournisseur
    sélectionné et renvoie l'audio généré (avec journalisation [TTS]).
    """

    def __init__(self, provider: TtsProvider):
        self._provider = provider

    @property
    def provider_name(self) -> str:
        return getattr(self._provider, "name", "unknown")

    def synthesize(self, text: str) -> TtsAudio:
        """Synthétise le texte en audio. Lève une des erreurs TTS normalisées."""
        # 1. Validation du texte.
        text = (text or "").strip()
        if not text:
            raise TtsValidationError("Le texte à synthétiser est vide.")
        if len(text) > MAX_TEXT_CHARS:
            raise TtsValidationError(
                f"Texte trop long ({len(text)} caractères, "
                f"max {MAX_TEXT_CHARS})."
            )

        # 2. Synthèse par le fournisseur.
        logger.info("[TTS] generating audio (provider=%s) text=%r…", self.provider_name, text[:80])
        audio = self._provider.synthesize(text)
        logger.info(
            "[TTS] audio generated (%d bytes, %s, provider=%s)",
            len(audio.content),
            audio.media_type,
            self.provider_name,
        )
        return audio


# ─────────────────────────────── Construction ────────────────────────────────


def _edge_available() -> bool:
    """edge-tts est-il installé ?"""
    try:
        import edge_tts  # noqa: F401

        return True
    except Exception:
        return False


def build_tts_service(settings=None) -> TextToSpeechService:
    """Construit le service TTS en fonction de la configuration (.env)."""
    from ..config import get_settings

    settings = settings or get_settings()
    provider_name = (settings.tts_provider or "auto").strip().lower()
    api_key = (settings.tts_api_key or "").strip()
    voice = (getattr(settings, "tts_voice", None) or DEFAULT_EDGE_VOICE).strip()
    system_voice = (getattr(settings, "tts_system_voice", None) or DEFAULT_SYSTEM_VOICE).strip()

    if provider_name == "mock":
        provider = MockTtsProvider()
    elif provider_name == "openai":
        if not api_key:
            raise TtsUnavailableError(
                "Fournisseur TTS 'openai' requis mais TTS_API_KEY absente (.env)."
            )
        provider = OpenAiTtsProvider(api_key=api_key)
    elif provider_name == "edge":
        if not _edge_available():
            raise TtsUnavailableError(
                "Fournisseur TTS 'edge' requis mais edge-tts n'est pas installé "
                "(pip install edge-tts)."
            )
        provider = EdgeTtsProvider(voice=voice)
    elif provider_name == "system":
        if not SystemTtsProvider.available():
            raise TtsUnavailableError(
                "Fournisseur TTS 'system' requis mais aucune voix système disponible."
            )
        provider = SystemTtsProvider(voice=system_voice)
    else:  # auto : fournisseurs réels, jamais de mock silencieux.
        if api_key:
            provider = OpenAiTtsProvider(api_key=api_key)
        elif _edge_available():
            provider = EdgeTtsProvider(voice=voice)
        elif SystemTtsProvider.available():
            provider = SystemTtsProvider(voice=system_voice)
        else:
            raise TtsUnavailableError(
                "Aucun fournisseur TTS réel disponible (TTS_API_KEY absente, "
                "edge-tts non installé, aucune voix système). Configurez "
                "TTS_API_KEY ou installez edge-tts (pip install edge-tts)."
            )

    return TextToSpeechService(provider=provider)


# Instance partagée du service (résolue à l'import).
text_to_speech_service = build_tts_service()
