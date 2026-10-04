"""Tests de la synthèse vocale (Text-to-Speech).

Le fournisseur est forcé en ``mock`` (variable TTS_PROVIDER) pour garantir des
tests hors ligne, sans clé API ni appel réseau. Le mock génère un vrai WAV,
donc les tests vérifient que l'audio renvoyé est réellement exploitable.
"""

import os

import pytest

os.environ["SERVICE_TOKEN"] = "test_token"
os.environ["TTS_PROVIDER"] = "mock"
os.environ["TTS_API_KEY"] = ""

from app.config import get_settings

get_settings.cache_clear()

from fastapi.testclient import TestClient

from app.main import app
from app.services import text_to_speech as tts_module
from app.services.text_to_speech import (
    EdgeTtsProvider,
    OpenAiTtsProvider,
    SystemTtsProvider,
    TtsProviderError,
    TtsUnavailableError,
    TtsValidationError,
    build_tts_service,
)

# Force le service singleton sur le mock (tests hors ligne), même si un autre
# module de test a déjà importé app.main avec le fournisseur auto (edge).
tts_module.text_to_speech_service = build_tts_service()

client = TestClient(app)

AUTH = {"X-Service-Token": "test_token"}

PHRASE = "Bonjour, pouvez-vous vous présenter ?"


def test_synthesize_mock_renvoie_un_vrai_wav():
    service = build_tts_service()
    audio = service.synthesize(PHRASE)

    assert audio.media_type == "audio/wav"
    assert audio.extension == "wav"
    assert audio.content.startswith(b"RIFF")
    assert audio.content[8:12] == b"WAVE"
    assert len(audio.content) > 1000


def test_post_synthesize_avec_vraie_phrase():
    response = client.post("/api/tts/synthesize", json={"text": PHRASE}, headers=AUTH)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.headers["x-audio-format"] == "wav"
    assert response.content.startswith(b"RIFF")
    assert response.content[8:12] == b"WAVE"


def test_post_synthesize_refuse_sans_jeton_service():
    response = client.post("/api/tts/synthesize", json={"text": PHRASE})
    assert response.status_code == 401


def test_post_synthesize_refuse_texte_vide():
    response = client.post("/api/tts/synthesize", json={"text": "   "}, headers=AUTH)
    assert response.status_code == 400
    assert "vide" in response.json()["detail"]


def test_post_synthesize_refuse_texte_trop_long():
    long_text = "a" * 1001
    response = client.post("/api/tts/synthesize", json={"text": long_text}, headers=AUTH)
    assert response.status_code == 400
    assert "trop long" in response.json()["detail"]


def test_openai_provider_ok(monkeypatch):
    provider = OpenAiTtsProvider(api_key="cle-test")

    class FakeResponse:
        status_code = 200
        content = b"ID3mp3-audio"

        @property
        def text(self):
            return ""

        def json(self):
            return {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, **kwargs):
            assert url == "https://api.openai.com/v1/audio/speech"
            assert kwargs["headers"]["Authorization"] == "Bearer cle-test"
            assert kwargs["json"]["model"] == "tts-1"
            assert kwargs["json"]["input"] == PHRASE
            return FakeResponse()

    monkeypatch.setattr("app.services.text_to_speech.httpx.Client", lambda **kwargs: FakeClient())

    audio = provider.synthesize(PHRASE)
    assert audio.media_type == "audio/mpeg"
    assert audio.extension == "mp3"
    assert audio.content == b"ID3mp3-audio"


def test_openai_provider_clé_invalide_leve_provider_error(monkeypatch):
    provider = OpenAiTtsProvider(api_key="mauvaise-cle")

    class FakeResponse:
        status_code = 401

        @property
        def text(self):
            return '{"error": {"message": "Invalid API key"}}'

        def json(self):
            return {"error": {"message": "Invalid API key"}}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("app.services.text_to_speech.httpx.Client", lambda **kwargs: FakeClient())

    try:
        provider.synthesize(PHRASE)
        raise AssertionError("TtsProviderError attendue pour une clé invalide")
    except TtsProviderError as exc:
        assert "clé" in str(exc).lower()


def test_build_openai_sans_cle_leve_une_erreur():
    import pytest

    class FakeSettings:
        tts_provider = "openai"
        tts_api_key = ""

    with pytest.raises(TtsUnavailableError):
        build_tts_service(settings=FakeSettings())


def test_build_mock_force_le_mock():
    class FakeSettings:
        tts_provider = "mock"
        tts_api_key = "cle-inutilisée"

    service = build_tts_service(settings=FakeSettings())
    assert service.provider_name == "mock"


def test_edge_provider_renvoie_un_mp3():
    """edge-tts produit un MP3 réellement parlant quand il est disponible."""
    pytest.importorskip("edge_tts")
    provider = EdgeTtsProvider(voice="fr-FR-DeniseNeural")

    audio = provider.synthesize("Bonjour, test de la voix de l'IA.")

    assert audio.extension == "mp3"
    assert audio.media_type == "audio/mpeg"
    assert audio.content[:3] == b"ID3" or audio.content[:2] == b"\xff\xf3"  # en-tête MP3
    assert len(audio.content) > 1000


def test_build_edge_sans_paquet_leve_une_erreur(monkeypatch):
    class FakeSettings:
        tts_provider = "edge"
        tts_api_key = ""
        tts_voice = "fr-FR-DeniseNeural"
        tts_system_voice = "Thomas"

    monkeypatch.setattr(
        "app.services.text_to_speech._edge_available",
        lambda: False,
    )
    with pytest.raises(TtsUnavailableError):
        build_tts_service(settings=FakeSettings())


def test_system_provider_produit_un_wav():
    if not SystemTtsProvider.available():
        return  # machine sans voix système : rien à tester ici
    provider = SystemTtsProvider(voice="Thomas")
    audio = provider.synthesize("Bonjour, ceci est un test de voix.")
    assert audio.extension == "wav"
    assert audio.content.startswith(b"RIFF")
    assert len(audio.content) > 1000
