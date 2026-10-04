# AI Service — Entretien IA vocal & vérification de documents

Microservice **Python / FastAPI** d'entretien IA vocal et de vérification des
documents d'onboarding pour la plateforme **STEG Internship**. Il s'intègre au
monorepo existant :

| Composant | Techno | Rôle |
|---|---|---|
| `backend/` | Node.js + Express (:3000) | API principale, candidatures, PostgreSQL |
| `frontweb/` | Angular (:4200) | Portail candidat (entretien IA textuel actuel) |
| `backoffice/` | Angular (:4400) | Panneau admin / RH |
| `steg_app/` | Flutter | Application mobile |
| `ai-service/` | **Python + FastAPI (:8001)** | **Entretien IA vocal + vérification de documents (ce service)** |

> Le service est volontairement isolé : il expose une API REST que le backend
> Node pourra appeler (serveur-à-serveur) pour l'orchestration de l'entretien
> vocal, la synthèse vocale (TTS), la transcription (STT), l'évaluation et la
> vérification des documents d'onboarding.

## Architecture

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py            # Application FastAPI + CORS
│   ├── config.py          # Paramètres lus depuis .env (pydantic-settings)
│   ├── routes/
│   │   ├── __init__.py    # Agrégation des routeurs
│   │   └── health.py      # GET /health
│   ├── services/          # Logique métier (TTS, STT, orchestration… à venir)
│   ├── models/            # Modèles de données (à venir)
│   └── schemas/           # Schémas Pydantic (contrats de réponse)
├── tests/
│   └── test_health.py     # Test de l'endpoint /health
├── requirements.txt       # Dépendances d'exécution
├── requirements-dev.txt   # Dépendances de test (pytest, httpx)
├── .env.example           # Variables d'environnement (copier → .env)
└── README.md
```

## Endpoints

### `GET /health`

État du service (utilisé par le backend Node et les monitors).

Réponse :

```json
{
  "status": "ok",
  "service": "ai-interview"
}
```

### `POST /api/tts/synthesize`

Synthèse vocale (Text-to-Speech). Appelé par le backend Node
(`backend/services/ai-voice.service.js`), jamais directement par le navigateur.

- **Authentification** : en-tête `X-Service-Token` (jeton de service partagé).
- **Requête** : `{ "text": "Bonjour, je suis l'assistant STEG." }`
- **Réponse** : fichier audio brut (`audio/mpeg` pour edge-tts/OpenAI,
  `audio/wav` pour la voix système) avec les en-têtes :
  - `X-Audio-Format` : `mp3` ou `wav` ;
  - `X-TTS-Provider` : `openai`, `edge` ou `system` (relu par Node pour le
    log `[TTS] … provider=…`).

Exemple :

```bash
curl -X POST http://localhost:8001/api/tts/synthesize \
  -H 'Content-Type: application/json' \
  -H 'X-Service-Token: <jeton>' \
  -d '{"text":"Bonjour STEG"}' -o synthese.mp3 -D -
```

### `POST /api/stt/transcribe`

Transcription vocale (Speech-to-Text), en cours d'intégration.

### `POST /api/documents/verify`

Vérification automatique des documents d'onboarding (`CV`, `CIN`,
`DEMANDE_STAGE`, `LETTRE_AFFECTATION`). Appelé par le backend Node
(serveur-à-serveur), jamais directement par le navigateur.

- **Authentification** : en-tête `X-Service-Token` (jeton de service partagé).
- **Requête** : multipart contenant :
  - `file` — le document à vérifier (pdf, docx, doc, txt, png, jpg, jpeg) ;
  - `document_type` — le type attendu (`CV`, `CIN`, `DEMANDE_STAGE`,
    `LETTRE_AFFECTATION`) ;
  - `candidature_id` — identifiant de la candidature (journalisation, pas de
    données personnelles) ;
  - `candidate` — JSON avec les informations du candidat du dossier backend :
    `{"nom": "...", "prenom": "...", "email": "...", "cin": "..."}`.
- **Réponse** : résultat structuré — statut (`VALID` / `REVIEW_REQUIRED` /
  `REJECTED`), score de confiance (0-100, plafonné à 95), type détecté,
  contrôles (`document_type_match`, `candidate_name_match`,
  `required_information_present`), anomalies et résumé.

```json
{
  "status": "REVIEW_REQUIRED",
  "confidence": 87,
  "document_type": "CIN",
  "checks": {
    "document_type_match": true,
    "candidate_name_match": true,
    "required_information_present": true
  },
  "issues": [],
  "summary": "Document cohérent avec le dossier du candidat."
}
```

**Précautions** :

- Le service **n'affirme jamais l'authenticité** d'un document : il parle de
  « document cohérent », « vérification recommandée » ou « anomalies détectées ».
- Aucune décision finale n'est automatisée sur la seule foi de ce résultat : il
  est destiné aux RH pour la validation manuelle.
- Sécurité : le numéro CIN, le contenu des documents, les mots de passe et les
  jetons ne sont jamais journalisés. Le résultat renvoyé ne contient aucune
  donnée personnelle brute.

Exemple :

```bash
curl -X POST http://localhost:8001/api/documents/verify \
  -H 'X-Service-Token: <jeton>' \
  -F 'file=@cv-salma.pdf' \
  -F 'document_type=CV' \
  -F 'candidature_id=00000000-0000-0000-0000-000000000001' \
  -F 'candidate={"nom":"Ben Ali","prenom":"Salma","email":"salma@example.tn","cin":"01234567"}'
```

## Lancement

Prérequis : Python 3.9+.

```bash
cd ai-service

# 1. Créer l'environnement virtuel
python -m venv venv

# 2. Activer l'environnement
source venv/bin/activate

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configuration
cp .env.example .env     # puis renseigner les clés locales

# 5. Lancer le serveur
uvicorn app.main:app --reload --port 8001
```

Vérifier :

```bash
curl http://localhost:8001/health
# {"status":"ok","service":"ai-interview"}
```

### Tests

```bash
cd ai-service
source venv/bin/activate
pip install -r requirements-dev.txt
pytest -v
```

### Arrêt

```bash
# Dans le terminal qui lance uvicorn : Ctrl-C
# Ou, pour tuer le processus sur le port 8001 :
lsof -ti:8001 | xargs kill
```

## Variables d'environnement (`.env`)

| Variable | Description |
|---|---|
| `PYTHON_SERVICE_PORT` | Port d'écoute du service (défaut `8001`) |
| `NODE_BACKEND_URL` | URL du backend Node (appels serveur-à-serveur + origine CORS) |
| `AI_API_KEY` | Clé API du fournisseur d'IA conversationnelle |
| `STT_API_KEY` | Clé API du fournisseur de transcription vocale (speech-to-text) |
| `TTS_API_KEY` | Clé API OpenAI pour la synthèse vocale (utilisée si `TTS_PROVIDER=openai` ou `auto` avec clé) |
| `TTS_PROVIDER` | Fournisseur TTS : `auto` (OpenAI → edge-tts → système), `openai`, `edge`, `system` ou `mock` |
| `TTS_VOICE` | Voix edge-tts (défaut `fr-FR-DeniseNeural`) |
| `TTS_SYSTEM_VOICE` | Voix système macOS `say` (défaut `Thomas`) |
| `INTERVIEW_TOKEN_SECRET` | Secret de signature des jetons d'entretien (partagé avec le backend Node) |
| `DOCUMENT_MAX_BYTES` | Taille maximale d'un document à vérifier en octets (défaut `10485760` = 10 Mo, aligné sur le backend Node) |
| `DOCUMENT_OCR_REQUIRED` | Si `true`, exige un moteur OCR (tesseract) pour lire les documents image/scannés, sinon erreur 503 |

**Aucun secret n'est écrit en dur dans le code** : toutes les clés sont lues
depuis `.env` (ignoré par git via `.gitignore`).

> **TTS** : en mode `auto` sans `TTS_API_KEY`, le service utilise **edge-tts**
> (voix neuronales Microsoft, gratuit) puis bascule sur la **voix système**
> (`say` sur macOS, `espeak-ng` sur Linux) si edge-tts est indisponible.

## CORS

Seules les origines locales nécessaires sont autorisées :

- `http://localhost:4200` — portail candidat (frontweb)
- `http://localhost:4400` — panneau admin (backoffice)
- `NODE_BACKEND_URL` si renseigné — backend Node

## Prochaines étapes (hors périmètre)

- Orchestration de l'entretien vocal (jetons d'entretien partagés avec le backend Node).
- Intégration STT complète (clé `STT_API_KEY`) et évaluation vocale, puis
  branchement dans `backend/services/ai/ai-interview.provider.service.js`.
