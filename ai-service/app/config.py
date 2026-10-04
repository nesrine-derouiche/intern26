"""Configuration du microservice d'entretien IA.

Les secrets (clés API STT/TTS/IA, secret de signature des jetons) ne sont
JAMAIS définis en dur dans le code : ils sont lus depuis ``.env`` (via
pydantic-settings). Les valeurs absentes restent vides — le service fonctionne
quand même (``/health`` ne dépend d'aucun secret).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables d'environnement du service (fichier ``.env``)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Port d'écoute du service Python (uvicorn).
    python_service_port: int = 8001

    # URL du backend Node.js/Express (appels serveur-à-serveur + CORS).
    node_backend_url: str = ""

    # Clés API des fournisseurs externes (IA conversationnelle, STT, TTS).
    ai_api_key: str = ""
    stt_api_key: str = ""
    tts_api_key: str = ""

    # Fournisseur de transcription vocale : "auto" (OpenAI si STT_API_KEY est
    # renseignée, sinon Mock local), "openai" (exige la clé) ou "mock".
    stt_provider: str = "auto"

    # Fournisseur de synthèse vocale : "auto" (OpenAI si TTS_API_KEY est
    # renseignée, sinon edge-tts, sinon voix système), "openai", "edge",
    # "system" (say/espeak-ng) ou "mock" (développement/tests uniquement).
    tts_provider: str = "auto"

    # Voix utilisées par les fournisseurs TTS réels.
    tts_voice: str = "fr-FR-DeniseNeural"  # edge-tts (voix neuronale française)
    tts_system_voice: str = "Thomas"  # voix système macOS (say)

    # Secret de signature des jetons d'entretien (partagé avec le backend Node).
    interview_token_secret: str = ""

    # Jeton de service partagé avec le backend Node (appels serveur-à-serveur).
    # Doit être identique à PYTHON_SERVICE_TOKEN dans backend/.env.
    service_token: str = ""

    # Vérification de documents d'onboarding (CV, CIN, DEMANDE_STAGE,
    # LETTRE_AFFECTATION) : taille maximale d'un document (octets), cohérente
    # avec la limite côté backend Node (10 Mo).
    document_max_bytes: int = 10 * 1024 * 1024

    # Si "true", le service exige un moteur OCR (tesseract) pour lire les
    # documents image/scannés et échoue en 503 s'il est indisponible.
    document_ocr_required: bool = False

    @property
    def cors_origins(self) -> list[str]:
        """Origines locales autorisées (frontends Angular + backend Node)."""
        origins = [
            "http://localhost:4200",  # portail candidat (frontweb)
            "http://localhost:4400",  # panneau admin (backoffice)
        ]
        if self.node_backend_url.strip():
            origins.append(self.node_backend_url.strip())
        return origins


@lru_cache
def get_settings() -> Settings:
    """Renvoie les paramètres en cache (chargés une seule fois)."""
    return Settings()
