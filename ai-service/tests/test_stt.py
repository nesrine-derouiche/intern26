"""Tests de la reconnaissance vocale (Speech-to-Text).

Le fournisseur est forcé en ``mock`` (variable STT_PROVIDER) pour garantir des
tests hors ligne, sans clé API ni appel réseau.
"""

import io
import math
import os
import struct
import wave

os.environ["SERVICE_TOKEN"] = "test_token"
os.environ["STT_PROVIDER"] = "mock"
os.environ["STT_API_KEY"] = ""

from app.config import get_settings

get_settings.cache_clear()

from fastapi.testclient import TestClient

from app.main import app
from app.services.speech_to_text import (
    OpenAiWhisperSttProvider,
    SttProviderError,
    SttUnavailableError,
    SttValidationError,
    build_stt_service,
)

client = TestClient(app)

AUTH = {"X-Service-Token": "test_token"}


def _make_wav(duration_s: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Génère un vrai fichier WAV (sinus mono) — audio réel au format valide."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = []
        for i in range(int(sample_rate * duration_s)):
            sample = int(8000 * math.sin(2 * math.pi * 440 * i / sample_rate))
            frames.append(struct.pack("<h", sample))
        wav.writeframes(b"".join(frames))
    return buffer.getvalue()


def test_transcribe_mock_renvoie_du_texte():
    service = build_stt_service()
    text = service.transcribe(_make_wav(), "voix.wav")
    assert isinstance(text, str)
    assert len(text) > 10


def test_post_transcribe_avec_fichier_audio_reel():
    files = {"file": ("voix.wav", _make_wav(), "audio/wav")}
    response = client.post("/api/stt/transcribe", files=files, headers=AUTH)
    assert response.status_code == 200
    payload = response.json()
    assert "text" in payload
    assert isinstance(payload["text"], str)
    assert payload["text"].strip()


def test_post_transcribe_refuse_sans_jeton_service():
    files = {"file": ("voix.wav", _make_wav(), "audio/wav")}
    response = client.post("/api/stt/transcribe", files=files)
    assert response.status_code == 401


def test_post_transcribe_refuse_audio_vide():
    files = {"file": ("vide.wav", b"", "audio/wav")}
    response = client.post("/api/stt/transcribe", files=files, headers=AUTH)
    assert response.status_code == 400


def test_post_transcribe_refuse_extension_inconnue_sans_ffmpeg():
    files = {"file": ("voix.aiff", b"fake-aiff", "audio/aiff")}
    response = client.post("/api/stt/transcribe", files=files, headers=AUTH)
    assert response.status_code == 400
    assert "Format audio non pris en charge" in response.json()["detail"]


def test_openai_provider_mape_les_erreurs(monkeypatch):
    provider = OpenAiWhisperSttProvider(api_key="cle-test")

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload

        def json(self):
            return self._payload

        @property
        def text(self):
            return str(self._payload)

    class FakeClient:
        def __init__(self, response):
            self._response = response

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, **kwargs):
            return self._response

    def fake_client_factory(**kwargs):
        return FakeClient(FakeResponse(401, {"error": {"message": "Invalid API key"}}))

    monkeypatch.setattr("app.services.speech_to_text.httpx.Client", fake_client_factory)

    try:
        provider.transcribe(b"audio", "voix.mp3")
        raise AssertionError("SttProviderError attendue pour une clé invalide")
    except SttProviderError as exc:
        assert "clé" in str(exc).lower()


def test_openai_provider_ok(monkeypatch):
    provider = OpenAiWhisperSttProvider(api_key="cle-test")

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"text": "Bonjour, je suis motivé."}

    class FakeClient:
        def __init__(self, response):
            self._response = response

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, **kwargs):
            assert url == "https://api.openai.com/v1/audio/transcriptions"
            assert kwargs["headers"]["Authorization"] == "Bearer cle-test"
            return self._response

    monkeypatch.setattr("app.services.speech_to_text.httpx.Client", lambda **kwargs: FakeClient(FakeResponse()))

    text = provider.transcribe(b"audio", "voix.mp3")
    assert text == "Bonjour, je suis motivé."


def test_build_openai_sans_cle_leve_une_erreur():
    import pytest

    class FakeSettings:
        stt_provider = "openai"
        stt_api_key = ""

    with pytest.raises(SttUnavailableError):
        build_stt_service(settings=FakeSettings())


def test_build_mock_force_le_mock():
    class FakeSettings:
        stt_provider = "mock"
        stt_api_key = "cle-inutilisée"

    service = build_stt_service(settings=FakeSettings())
    assert service.provider_name == "mock"
