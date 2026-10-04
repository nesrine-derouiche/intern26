# STEG Internship Platform — Documentation Technique Complète

> **Société Tunisienne de l'Électricité et du Gaz (STEG)**
> Plateforme de gestion des stages et opportunités professionnelles
> Version du document : 1.0 — Septembre 2026

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Architecture technique](#2-architecture-technique)
3. [Stack technologique](#3-stack-technologique)
4. [Backend — Node.js / Express](#4-backend--nodejs--express)
5. [Backoffice — Angular 22](#5-backoffice--angular-22)
6. [Frontweb — Angular 22](#6-frontweb--angular-22)
7. [Application Mobile — Flutter](#7-application-mobile--flutter)
8. [Service IA — Python / FastAPI](#8-service-ia--python--fastapi)
9. [Flux métier principaux](#9-flux-métier-principaux)
10. [Schéma de la base de données](#10-schéma-de-la-base-de-données)
11. [Référence API complète](#11-référence-api-complète)
12. [Sécurité et authentification](#12-sécurité-et-authentification)
13. [Guide d'installation et de déploiement](#13-guide-dinstallation-et-de-déploiement)

---

## 1. Vue d'ensemble du projet

### 1.1 Contexte

Le projet **STEG Internship** est une plateforme numérique complète de gestion des stages pour la Société Tunisienne de l'Électricité et du Gaz (STEG). Elle couvre l'ensemble du cycle de vie d'un stagiaire : de la candidature à la fin du stage, en passant par des entretiens assistés par IA, la vérification de documents par intelligence artificielle, et la gestion opérationnelle des stages.

### 1.2 Objectifs

- **Digitaliser** le processus de recrutement des stagiaires
- **Automatiser** la présélection via un système d'entretien IA vocal
- **Sécuriser** la vérification des documents d'onboarding par IA
- **Centraliser** la gestion des stages, tâches, évaluations et réunions
- **Offrir** une expérience mobile aux stagiaires via une application Flutter
- **Fournir** un tableau de bord adapté à chaque rôle (Admin, RH, Encadrant, Chef de département)

### 1.3 Acteurs du système

| Rôle | Description | Interfaces |
|------|-------------|------------|
| **CANDIDAT** | Postule aux offres de stage, passe l'entretien IA, fournit les documents | Frontweb |
| **STAGIAIRE** | Effectue son stage, gère ses tâches, soumet des rapports | Application Mobile Flutter |
| **ENCADRANT** | Supervise les stagiaires, crée des tâches, évalue | Backoffice |
| **CHEF_DEPARTEMENT** | Gère les offres de son département, pré-sélectionne les candidats | Backoffice |
| **RH** | Valide les périodes de stage, planifie les entretiens humains, traite l'onboarding | Backoffice |
| **ADMIN** | Accès complet à toutes les fonctionnalités | Backoffice |

---

## 2. Architecture technique

### 2.1 Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTENDS                                      │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  Frontweb    │  │  Backoffice  │  │     Application Mobile       │  │
│  │  Angular 22  │  │  Angular 22  │  │         Flutter              │  │
│  │  Port 4200   │  │  Port 4400   │  │     iOS / Android            │  │
│  │  Candidat    │  │  Admin/RH/   │  │     Stagiaire                │  │
│  │  Portal      │  │  Encadrant   │  │                              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
│         │                 │                          │                   │
│         └─────────────────┼──────────────────────────┘                   │
│                           │  HTTP REST API                               │
│                           ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Backend Node.js / Express                       │  │
│  │                        Port 3000                                   │  │
│  │                                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │  Auth    │ │ Routes   │ │ Services │ │ Repos    │            │  │
│  │  │  JWT     │ │ 22 files │ │ 30+ files│ │ 24 files │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  │                                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │  Middle- │ │ Validators│ │Templates │ │  Cron    │            │  │
│  │  │  wares   │ │ 16 files │ │ 15 files │ │  Jobs    │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  └────────────┬──────────────────────────────┬───────────────────────┘  │
│               │                              │                          │
│               ▼                              ▼                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐    │
│  │   PostgreSQL :5433   │    │     Python AI Service :8001         │    │
│  │   21 tables          │    │     FastAPI / Uvicorn               │    │
│  │   6 enums            │    │                                      │    │
│  │   UUID primary keys  │    │  ┌────────┐ ┌────────┐ ┌────────┐ │    │
│  └─────────────────────┘    │  │  TTS   │ │  STT   │ │  Doc   │ │    │
│                              │  │ 4 prov.│ │ 2 prov.│ │ Verify │ │    │
│                              │  └────────┘ └────────┘ └────────┘ │    │
│                              └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Communication inter-services

| Source | Destination | Protocole | Authentification |
|--------|-------------|-----------|------------------|
| Frontweb (Candidat) | Backend :3000 | HTTP REST | JWT Bearer |
| Backoffice (RH/Admin) | Backend :3000 | HTTP REST | JWT Bearer |
| Flutter (Stagiaire) | Backend :3000 | HTTP REST | JWT Bearer |
| Backend :3000 | AI Service :8001 | HTTP REST | `X-Service-Token` |
| Backend :3000 | PostgreSQL :5433 | TCP | User/Password |
| Backend :3000 | Gmail SMTP | SMTP | App Password |

---

## 3. Stack technologique

### 3.1 Backend

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Runtime | Node.js | LTS |
| Framework | Express | 5.x |
| Base de données | PostgreSQL | 16 |
| ORM/Driver | pg (node-postgres) | — |
| Authentification | JWT (jsonwebtoken) | — |
| Hachage mots de passe | bcrypt | — |
| Validation | express-validator | — |
| Upload fichiers | Multer | — |
| Email | Nodemailer | — |
| Sécurité HTTP | Helmet | — |
| Notifications push | Firebase Admin SDK | — |
| Chiffrement mobile | AES-256-GCM (Node crypto) | — |
| Tests | Jest + Supertest | — |

### 3.2 Backoffice

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Angular | 22.0.0 |
| Langage | TypeScript | 6.0.3 |
| UI Kit | Berry Admin Template | 6.0.0 |
| CSS Framework | Bootstrap SCSS | 5.3.8 |
| Charts | ApexCharts + ng-apexcharts | 5.13.0 |
| Icons | Tabler Icons | — |
| Testing | Vitest | 4.1.10 |
| Linting | ESLint + @angular-eslint | 22.0.0 |
| Formatting | Prettier | 3.8.3 |
| Package Manager | Yarn | 4.13.0 |
| Dev Server Port | 4400 | — |

### 3.3 Frontweb

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Angular | 22.1.0 |
| Langage | TypeScript | 6.0.2 |
| State Management | Angular Signals | — |
| Testing | Vitest | 4.0.8 |
| Package Manager | npm | 11.17.0 |
| Dev Server Port | 4200 | — |
| Police | Google Inter | CDN |

### 3.4 Application Mobile

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Flutter | SDK 3.x |
| Langage | Dart | — |
| State Management | Riverpod | — |
| Routing | GoRouter | — |
| HTTP Client | Dio | — |
| Stockage local | SharedPreferences | — |
| Notifications push | Firebase Messaging | — |
| Platforms | iOS, Android | — |

### 3.5 Service IA

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | FastAPI | 0.115.6 |
| ASGI Server | Uvicorn | 0.34.0 |
| Validation | Pydantic | 2.10.4 |
| HTTP Client | httpx | 0.28.1 |
| TTS | edge-tts / OpenAI | 7.2.8 |
| STT | OpenAI Whisper | — |
| Extraction PDF | pypdf | 6.16.1 |
| Extraction DOCX | python-docx | 1.2.0 |
| Tests | pytest | 8.3.4 |
| Port | 8001 | — |

---

## 4. Backend — Node.js / Express

### 4.1 Point d'entrée : `server.js`

Le serveur démarre sur le port **3000** (configurable via `PORT`). La pile de middleware dans l'ordre d'exécution :

1. `helmet()` — En-têtes de sécurité HTTP
2. `securityHeaders` — Cache-Control, Permissions-Policy personnalisés
3. `cors()` — CORS configurable via `CORS_ORIGIN`
4. `express.json()` — Parsing du body JSON
5. Rate limiter général : 1000 requêtes / 15 minutes
6. Rate limiter auth : 50 requêtes / 15 minutes
7. Routes `/api` (22 fichiers de routes montées via `routes/index.js`)
8. `notFoundHandler` — Catch-all 404
9. `globalErrorHandler` — Gestion centralisée des erreurs (PG unique violation → 400)

**Jobs planifiés démarrés au lancement :**
- `humanInterviewReminderJob` — Toutes les 5 minutes, envoie des rappels pour les entretiens du jour
- `mobileAccessEmailJob` — Toutes les 60 minutes, envoie les identifiants temporaires mobile aux stagiaires dont le stage commence demain

### 4.2 Structure des fichiers

```
backend/
├── server.js                    # Point d'entrée
├── package.json                 # Dépendances et scripts
├── .env / .env.example          # Variables d'environnement
├── config/
│   ├── db.js                    # Pool PostgreSQL + withTransaction()
│   ├── email.js                 # Transporteur Nodemailer
│   ├── mobile.js                # Chiffrement AES-256-GCM mobile
│   └── uploads.js               # Répertoire uploads
├── database/
│   ├── schema.sql               # Schéma complet (21 tables, 6 enums)
│   ├── migrate.js               # Migrations idempotentes
│   └── mock_demo.sql            # Données de démonstration
├── models/                      # Modèles de données
├── repositories/                # 24 fichiers — accès DB
├── services/                    # 30+ fichiers — logique métier
├── controllers/                 # 22 fichiers — handlers HTTP
├── routes/                      # 22 fichiers — routes Express
│   └── index.js                 # Montage de toutes les routes sous /api
├── middlewares/                  # 7 fichiers — auth, RBAC, scope
├── validators/                  # 16 fichiers — express-validator
├── templates/email/             # 15 templates HTML d'emails
├── utils/                       # 9 fichiers — utilitaires
├── uploads/                     # Fichiers uploadés
└── __tests__/                   # 22+ fichiers de tests Jest
```

### 4.3 Base de données

#### Extensions PostgreSQL

- `uuid-ossp` — Génération UUID
- `pgcrypto` — Chiffrement
- `unaccent` — Recherche insensitive aux accents

#### Enums

| Enum | Valeurs |
|------|---------|
| `role_utilisateur` | ADMIN, STAGIAIRE, ENCADRANT, CHEF_DEPARTEMENT, RH, CANDIDAT |
| `statut_candidature` | EN_ATTENTE, PRESELECTIONNE, PREselection_ACCEPTEE, PREselection_REFUSEE, EN_COURS_D_EXAMEN, ACCEPTEE, REFUSEE, ANNULEE |
| `statut_stage` | EN_ATTENTE, EN_COURS, TERMINE |
| `statut_tache` | A_FAIRE, EN_COURS, TERMINEE, ANNULEE |
| `statut_evaluation` | PLANIFIEE, EN_COURS, TERMINEE |
| `statut_onboarding` | NON_DEMANDE, EN_COURS, COMPLETE, VALIDATED |
| `statut_entretien_ia` | EN_ATTENTE, EN_COURS, TERMINE, ABANDONNE |

#### Tables (21)

| Table | Description | Clé étrangère principale |
|-------|-------------|--------------------------|
| `utilisateur` | Utilisateurs (base commune) | — |
| `administrateur` | Profil admin | → utilisateur |
| `chef_departement` | Chef de département | → utilisateur |
| `rh` | Ressources humaines | → utilisateur |
| `encadrant` | Encadrants/Superviseurs | → utilisateur |
| `stagiaire` | Stagiaires | → utilisateur |
| `candidat` | Candidats aux offres | → utilisateur |
| `departement` | Départements STEG | → chef_departement |
| `offre_stage` | Offres de stage | → departement, → encadrant |
| `candidature` | Candidatures | → candidat, → offre_stage |
| `stage` | Stages actifs | → candidature, → stagiaire, → encadrant |
| `projet` | Projets de stage | → stage |
| `tache` | Tâches de projet | → projet, → createur, → executant |
| `tache_personnelle` | Tâches personnelles Kanban | → stagiaire |
| `reunion` | Réunions | → stage |
| `evaluation` | Évaluations de stage | → stage, → evaluateur |
| `journal` | Journal de bord | → stage, → stagiaire |
| `document` | Documents de stage | → stage, → uploadé par |
| `notification` | Notifications | → utilisateur |
| `cv_analyse` | Analyses CV par IA | → candidat |
| `ai_interview_session` | Sessions entretien IA | → candidature |
| `human_interview` | Entretiens humains | → candidature |
| `candidature_document` | Documents d'onboarding | → candidature |
| `device_token` | Tokens FCM mobile | → stagiaire |
| `permission` | Permissions RBAC | — |
| `utilisateur_permission` | Permissions utilisateurs | → utilisateur, → permission |

### 4.4 Rôles et autorisations

| Rôle | Capacités principales |
|------|----------------------|
| **ADMIN** | Accès complet — CRUD tous les utilisateurs, départements, offres, candidatures, stages |
| **CHEF_DEPARTEMENT** | Gérer les offres de son département, pré-sélectionner les candidats, voir les stages du département |
| **RH** | Valider les périodes de stage, planifier les entretiens humains, traiter l'onboarding, envoyer les accès mobile |
| **ENCADRANT** | Superviser les stagiaires assignés, créer/modifier les tâches, créer/valider les journaux, créer des réunions, évaluer |
| **STAGIAIRE** | Voir son stage, mettre à jour la progression des tâches, soumettre des journaux, gérer son Kanban personnel, accéder à l'app mobile |
| **CANDIDAT** | Parcourir les offres, soumettre des candidatures, uploader les documents d'onboarding, passer l'entretien IA |

#### Middlewares d'autorisation

| Middleware | Fonction |
|------------|----------|
| `auth` | Vérifie le JWT, charge l'utilisateur dans `req.user` |
| `role(...roles)` | Vérifie que l'utilisateur a l'un des rôles autorisés |
| `withScope` | Résout le filtre SQL scope (user/department/all) selon le rôle |
| `authorizeResource` | Vérifie rôle + ownership ( propriétaire ou admin) |
| `authorizeStage` | Accès spécifique aux stages (admin/RH = tous, encadrant = créés, stagiaire = assignés) |
| `enforceOnboardingAccess` | Restreint l'accès aux stagiaires pour les tâches personnelles |

### 4.5 Routes API complètes

#### Authentification (`/api/auth`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| POST | `/register` | Public | Inscription d'un nouvel utilisateur |
| POST | `/login` | Public | Connexion, retourne JWT |
| POST | `/verify-email` | Public | Vérification email avec token |
| POST | `/resend-verification` | Public | Renvoyer email de vérification |
| POST | `/forgot-password` | Public | Demande de réinitialisation |
| POST | `/reset-password` | Public | Réinitialisation avec token |
| GET | `/me` | Authentifié | Profil utilisateur courant |
| PUT | `/profile` | Authentifié | Mise à jour du profil |
| PUT | `/change-password` | Authentifié | Changement de mot de passe |

#### Candidat (`/api/candidat`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | CANDIDAT, ADMIN | Mon profil |
| PUT | `/` | CANDIDAT | Modifier mon profil |
| PUT | `/password` | CANDIDAT | Changer mon mot de passe |
| POST | `/photo` | CANDIDAT | Upload photo de profil |
| POST | `/cv` | CANDIDAT | Upload CV (PDF/DOCX/DOC, max 5MB) |
| DELETE | `/cv` | CANDIDAT | Supprimer mon CV |
| GET | `/cv-info` | CANDIDAT | Métadonnées du CV |
| GET | `/cv` | CANDIDAT | Télécharger mon CV |

#### Candidats — Gestion (`/api/candidats`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/Chef/RH | Liste paginée de tous les candidats |
| GET | `/:id` | Admin/Chef/RH | Détails d'un candidat |

#### Offres de stage (`/api/offres`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Public | Liste des offres publiées |
| GET | `/:id` | Public | Détails d'une offre |
| POST | `/` | Admin, Chef | Créer une offre |
| PUT | `/:id` | Admin, Chef | Modifier une offre |
| DELETE | `/:id` | Admin | Supprimer une offre |

#### Candidatures (`/api/candidatures`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/RH/Chef | Liste des candidatures (filtrées par scope) |
| GET | `/my` | CANDIDAT | Mes candidatures |
| GET | `/my-candidatures` | CANDIDAT | Mes candidatures avec infos offre |
| GET | `/:id` | Selon rôle | Détails d'une candidature |
| POST | `/` | CANDIDAT | Soumettre une candidature |
| PUT | `/:id/preselect` | Chef | Pré-sélectionner un candidat |
| PUT | `/:id/accept-preselection` | CANDIDAT | Accepter la pré-sélection |
| PUT | `/:id/reject-preselection` | CANDIDAT | Refuser la pré-sélection |
| PUT | `/:id/accept-after-ai-interview` | CANDIDAT | Accepter après entretien IA |
| PUT | `/:id/human-interview/schedule` | RH | Planifier entretien humain |
| POST | `/:id/human-interview/validate-period` | RH | Valider la période de stage |
| GET | `/:id/internship-readiness` | Selon rôle | Vérifier la préparation au stage |
| POST | `/:id/convert-to-trainee` | RH | Convertir en stagiaire |
| GET | `/:id/onboarding/documents` | Selon rôle | Liste des documents d'onboarding |
| POST | `/:id/onboarding/documents` | CANDIDAT | Uploader un document d'onboarding |
| POST | `/:id/onboarding/documents/:docId/verify` | CANDIDAT | Déclencher la vérification IA |
| POST | `/:id/onboarding/documents/:docId/decide` | RH | Accepter/Refuser un document |
| GET | `/:id/onboarding/documents/:docId/download` | Selon rôle | Télécharger un document |
| GET | `/stage-preferences` | CANDIDAT | Préférences de stage |
| PUT | `/stage-preferences` | CANDIDAT | Mettre à jour les préférences |

#### Entretien IA — Legacy (`/api/entretien-ia`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/health` | Public | Health check |
| GET | `/:token` | Token | Récupérer l'entretien par token |
| POST | `/:token/start` | Token | Démarrer l'entretien |
| POST | `/:token/save-answer` | Token | Sauvegarder une réponse |
| POST | `/:token/audio` | Token | Uploader réponse audio |
| POST | `/:token/synthesize` | Token | Synthèse TTS |
| POST | `/:token/integrity` | Token | Événements d'intégrité |
| POST | `/:token/fingerprint` | Token | Empreinte navigateur |
| POST | `/:token/complete` | Token | Terminer l'entretien |
| POST | `/:token/quit` | Token | Quitter l'entretien |

#### Entretien IA — Moteur (`/api/ai-interviews`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| POST | `/` | CANDIDAT | Lister mes entretiens IA |
| POST | `/create/:candidatureId` | CANDIDAT | Créer une session |
| GET | `/:id` | CANDIDAT | Détails de la session |
| POST | `/:id/start` | CANDIDAT | Démarrer (première question) |
| POST | `/:id/answer` | CANDIDAT | Soumettre réponse |
| POST | `/:id/complete` | CANDIDAT | Terminer l'entretien |
| GET | `/:id/report` | CANDIDAT | Rapport d'évaluation |

#### Stages (`/api/stages`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/RH | Lister tous les stages |
| GET | `/my` | ENCADRANT | Mes stages supervisés |
| GET | `/mes-stages` | STAGIAIRE | Mes stages |
| GET | `/:id` | Selon rôle | Détails d'un stage |
| PUT | `/:id` | Admin, RH | Modifier un stage |
| GET | `/overview/:stagiaireId` | ENCADRANT/RH | Vue d'ensemble stagiaire |
| GET | `/convention/:id/pdf` | Selon rôle | Générer PDF convention |
| GET | `/attestation/:id/pdf` | Selon rôle | Générer PDF attestation |
| GET | `/evaluation/:id/pdf` | Selon rôle | Générer PDF évaluation |

#### Tâches (`/api/taches`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/RH/ENCADRANT | Lister les tâches |
| GET | `/mes-taches` | ENCADRANT/STAGIAIRE | Mes tâches |
| GET | `/:id` | Selon rôle | Détails d'une tâche |
| POST | `/` | ENCADRANT | Créer une tâche |
| PUT | `/:id` | Selon rôle | Modifier une tâche |
| DELETE | `/:id` | Admin/ENCADRANT | Supprimer une tâche |

#### Tâches personnelles Kanban (`/api/personal-taches`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | STAGIAIRE | Mes tâches personnelles |
| GET | `/counts` | STAGIAIRE | Compteurs par statut |
| GET | `/:id` | STAGIAIRE | Détails d'une tâche |
| POST | `/` | STAGIAIRE | Créer une tâche |
| PUT | `/:id` | STAGIAIRE | Modifier une tâche |
| PATCH | `/:id/move` | STAGIAIRE | Déplacer (Drag & Drop) |
| DELETE | `/:id` | STAGIAIRE | Supprimer une tâche |

#### Réunions (`/api/reunions`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | ENCADRANT/STAGIAIRE | Lister les réunions |
| GET | `/:id` | Selon rôle | Détails d'une réunion |
| POST | `/` | ENCADRANT | Créer une réunion |
| DELETE | `/:id` | Admin | Supprimer une réunion |

#### Évaluations (`/api/evaluations`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | ENCADRANT/RH | Lister les évaluations |
| GET | `/:id` | Selon rôle | Détails d'une évaluation |
| POST | `/` | ENCADRANT/RH | Créer une évaluation |
| PUT | `/:id` | ENCADRANT/RH | Modifier une évaluation |

#### Journaux (`/api/journaux`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | ENCADRANT/STAGIAIRE | Lister les journaux |
| GET | `/mes-journaux` | STAGIAIRE | Mes journaux |
| GET | `/:id` | Selon rôle | Détails d'un journal |
| POST | `/` | STAGIAIRE | Créer un journal |
| PUT | `/:id` | STAGIAIRE | Modifier un journal |
| POST | `/valider/:id` | ENCADRANT | Valider un journal |

#### Notifications (`/api/notifications`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Authentifié | Mes notifications |
| PUT | `/:id/read` | Authentifié | Marquer comme lu |
| PUT | `/read-all` | Authentifié | Tout marquer comme lu |
| GET | `/unread-count` | Authentifié | Nombre non lues |

#### Documents (`/api/documents`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/stage/:stageId` | Selon rôle | Documents du stage |
| POST | `/upload` | ENCADRANT/STAGIAIRE | Uploader un document |
| GET | `/:id` | Selon rôle | Détails d'un document |
| DELETE | `/:id` | ENCADRANT | Supprimer un document |

#### Dashboard (`/api/dashboard`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/stats` | Admin/RH | Statistiques globales |
| GET | `/recent-activity` | Admin/RH | Activité récente |
| GET | `/stages-overview` | Admin/RH | Vue d'ensemble des stages |

#### Recherche (`/api/search`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Authentifié | Recherche globale |

#### Public (`/api/public`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/offres` | Public | Offres publiées |
| GET | `/offres/:id` | Public | Détails d'une offre |
| GET | `/departements` | Public | Liste des départements |

#### Départements (`/api/departements`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Authentifié | Lister les départements |
| GET | `/:id` | Authentifié | Détails d'un département |
| POST | `/` | Admin | Créer un département |
| PUT | `/:id` | Admin | Modifier un département |
| DELETE | `/:id` | Admin | Supprimer un département |

#### Encadrants (`/api/encadrants`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/RH | Lister les encadrants |
| GET | `/:id` | Admin/RH | Détails d'un encadrant |
| POST | `/` | Admin | Créer un encadrant |
| PUT | `/:id` | Admin | Modifier un encadrant |
| DELETE | `/:id` | Admin | Supprimer un encadrant |

#### Stagiaires (`/api/stagiaires`)

| Méthode | Endpoint | Accès | Description |
|---------|----------|-------|-------------|
| GET | `/` | Admin/RH/ENCADRANT | Lister les stagiaires |
| GET | `/:id` | Admin/RH/ENCADRANT | Détails d'un stagiaire |
| POST | `/` | Admin | Créer un stagiaire |
| PUT | `/:id` | Admin | Modifier un stagiaire |
| DELETE | `/:id` | Admin | Supprimer un stagiaire |

### 4.6 Services métier (fichiers clés)

| Service | Description |
|---------|-------------|
| `candidature.service.js` | Pipeline candidature → stage, pré-sélection, entretiens, onboarding |
| `ai-interview.service.js` | Entretien IA legacy (token-based), bridge vers Python |
| `ai-interview-engine.service.js` | Entretien IA moteur (session-based), scoring, intégrité |
| `personal-tache.service.js` | Tâches personnelles Kanban du stagiaire |
| `stage.service.js` | Gestion des stages, PDF (convention, attestation, évaluation) |
| `onboarding.service.js` | Vérification documents d'onboarding |
| `document-verification.service.js` | Bridge vers le service Python de vérification |
| `notification.service.js` | Envoi de notifications |
| `authorization.service.js` | Résolution RBAC, scope, ownership |
| `email-templates.service.js` | Rendu et envoi des emails |
| `human-interview-reminder.job.js` | Cron : rappels entretiens |
| `mobile-access-email.job.js` | Cron : emails d'accès mobile |

### 4.7 Templates d'emails (15 templates)

| Template | Utilisation |
|----------|-------------|
| `welcome` | Bienvenue après inscription |
| `email-verification` | Vérification d'email |
| `password-reset` | Réinitialisation de mot de passe |
| `candidature-submitted` | Candidature reçue |
| `candidature-accepted` | Candidature acceptée |
| `candidature-rejected` | Candidature refusée |
| `preselection` | Pré-sélection通知 |
| `ai-interview-invitation` | Invitation entretien IA |
| `ai-interview-result` | Résultat entretien IA |
| `human-interview-scheduled` | Entretien humain planifié |
| `human-interview-reminder` | Rappel entretien humain |
| `stage-confirmed` | Stage confirmé |
| `mobile-access` | Accès application mobile |
| `onboarding-document-accepted` | Document accepté |
| `onboarding-document-rejected` | Document refusé |

### 4.8 Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | 3000 |
| `JWT_SECRET` | Secret JWT | — |
| `JWT_EXPIRES_IN` | Durée de validité JWT | — |
| `CORS_ORIGIN` | Origines CORS autorisées | — |
| `FRONTEND_URL` | URL du frontweb | — |
| `PYTHON_AI_SERVICE_URL` | URL du service IA | http://localhost:8001 |
| `PYTHON_SERVICE_TOKEN` | Token d'auth service-to-service | — |
| `PYTHON_AI_TIMEOUT_MS` | Timeout IA | — |
| `AI_DOCUMENT_SERVICE_URL` | URL vérification documents | — |
| `AI_DOCUMENT_SERVICE_TOKEN` | Token vérification documents | — |
| `AI_MOCK_SCORE` | Score IA mock (développement) | — |
| `DB_HOST` | Hôte PostgreSQL | localhost |
| `DB_PORT` | Port PostgreSQL | 5433 |
| `DB_NAME` | Nom de la base | steg_stage |
| `DB_USER` | Utilisateur PostgreSQL | postgres |
| `DB_PASS` | Mot de passe PostgreSQL | — |
| `MAIL_HOST` | Serveur SMTP | — |
| `MAIL_PORT` | Port SMTP | — |
| `MAIL_SECURE` | SSL/TLS | — |
| `MAIL_USER` | Utilisateur SMTP | — |
| `MAIL_PASS` | Mot de passe SMTP | — |
| `MAIL_FROM` | Adresse d'expéditeur | — |
| `GOOGLE_APPLICATION_CREDENTIALS` | Clé Firebase | — |
| `REMINDER_JOB_ENABLED` | Activer les rappels | true |
| `MOBILE_ACCESS_JOB_ENABLED` | Activer les emails mobile | true |
| `MOBILE_ACCESS_JOB_INTERVAL_MIN` | Intervalle emails mobile | 60 |

---

## 5. Backoffice — Angular 22

### 5.1 Vue d'ensemble

Application Angular 22 pour les administrateurs, RH, encadrants et chefs de département. Basée sur le template **Berry Admin** (v6.0.0), elle offre un tableau de bord adaptatif par rôle et la gestion complète de toutes les entités de la plateforme.

**Port de développement :** 4400

### 5.2 Structure

```
backoffice/src/
├── main.ts                           # Bootstrap avec HttpClient + authInterceptor
├── index.html                        # Shell HTML
├── styles.scss                       # Styles globaux (Bootstrap + Berry + STEG)
├── app/
│   ├── app-config.ts                 # Configuration Berry (police, collapse)
│   ├── app.component.ts              # Composant racine
│   ├── app-routing.module.ts         # Toutes les routes
│   ├── core/
│   │   ├── guards/auth.guard.ts      # authGuard + guestGuard
│   │   ├── interceptors/auth.interceptor.ts  # JWT Bearer
│   │   ├── pipes/relative-time.pipe.ts       # "il y a 5 min"
│   │   └── data/                     # 15 services (API)
│   ├── theme/
│   │   ├── layout/admin/             # Layout sidebar + navbar
│   │   ├── layout/guest/             # Layout bare (login)
│   │   └── shared/                   # Composants partagés
│   └── demo/
│       ├── dashboard/default/        # Tableau de bord adaptatif
│       └── pages/                    # 14 pages métier
```

### 5.3 Routes

| Route | Composant | Lazy | Accès |
|-------|-----------|------|-------|
| `/default` | DefaultComponent | Oui | Authentifié (bloque STAGIAIRE) |
| `/stagiaires` | StagiairesComponent | Oui | Authentifié |
| `/encadrants` | EncadrantsComponent | Oui | Authentifié |
| `/taches` | TachesComponent | Oui | Authentifié |
| `/stages` | StagesComponent | Oui | Authentifié |
| `/reunions` | ReunionsComponent | Oui | Authentifié |
| `/offres` | OffresComponent | Oui | Authentifié |
| `/candidatures` | CandidaturesComponent | Oui | Authentifié |
| `/candidatures/:id` | CandidatureDetailsComponent | Oui | Authentifié |
| `/evaluations` | EvaluationsComponent | Oui | Authentifié |
| `/departements` | DepartementsComponent | Oui | Authentifié |
| `/notifications` | NotificationsComponent | Oui | Authentifié |
| `/login` | LoginComponent | Oui | Guest uniquement |

### 5.4 Tableau de bord adaptatif

Le composant `DefaultComponent` affiche un tableau de bord différent selon le rôle :

| Rôle | KPI | Graphiques | Alertes |
|------|-----|------------|---------|
| **ADMIN** | 8 cartes KPI (stagiaires, encadrants, offres, candidatures, stages, tâches, etc.) | Area, bar, donut, horizontal bar | Stages se terminant, évaluations manquantes, rapports en attente, offres expirant |
| **RH** | 8 KPI RH (candidatures, stages, accès mobile) | Apps by month, by dept, recruitment donut, offres by dept | Documents manquants, entretiens à prévoir, stages démarrant |
| **ENCADRANT** | 5 KPI (stagiaires, réunions, rapports, tâches) | Task progress radial, stage progression, task status donut, meetings by month | Tâches du jour, tâches en retard, rapports soumis |

### 5.5 Services (15 services Angular)

| Service | Fichier | Endpoints appelés |
|---------|---------|-------------------|
| `AuthService` | auth.service.ts | `/auth/login`, `/auth/register`, `/auth/me` |
| `DashboardService` | dashboard.service.ts | `/dashboard/stats` |
| `ApplicationService` | application.service.ts | `/candidatures/*` (CRUD + entretiens + onboarding) |
| `OfferService` | offer.service.ts | `/offres/*` (CRUD) |
| `InternService` | intern.service.ts | `/stagiaires/*` (CRUD) |
| `InternshipService` | internship.service.ts | `/stages/*` (CRUD + PDF) |
| `SupervisorService` | supervisor.service.ts | `/encadrants/*` (CRUD) |
| `MeetingService` | meeting.service.ts | `/reunions/*` (CRUD) |
| `EvaluationService` | evaluation.service.ts | `/evaluations/*` (CRUD) |
| `NotificationService` | notification.service.ts | `/notifications/*` (paginé, read/unread) |
| `TaskService` | task.service.ts | `/taches/*` (CRUD + mes-taches) |
| `DepartmentService` | department.service.ts | `/departements/*` (CRUD) |
| `SearchService` | search.service.ts | `/search` |
| `MessageService` | message.service.ts | `/messages/*` (chat) |
| `ProjectService` | project.service.ts | `/projets/*` (CRUD) |

### 5.6 Menu de navigation par rôle

| Élément | URL | Icône | Visibilité |
|---------|-----|-------|------------|
| Tableau de bord | `/default` | `ti-dashboard` | ADMIN, RH, ENCADRANT, CHEF |
| Stagiaires | `/stagiaires` | `ti-users` | ADMIN, RH, CHEF |
| Encadrants | `/encadrants` | `ti-user-check` | ADMIN, RH, CHEF |
| Tâches | `/taches` | `ti-checkbox` | ADMIN, RH, ENCADRANT |
| Stages | `/stages` | `ti-school` | ADMIN, RH, ENCADRANT, CHEF |
| Réunions | `/reunions` | `ti-calendar` | ADMIN, RH, ENCADRANT, CHEF |
| Offres de Stage | `/offres` | `ti-file-text` | ADMIN, RH |
| Candidatures | `/candidatures` | `ti-send` | ADMIN, RH |
| Évaluations | `/evaluations` | `ti-star` | ADMIN, RH, ENCADRANT |
| Départements | `/departements` | `ti-building` | ADMIN, RH |

### 5.7 Système de design

- **Token principal :** `#5B5CEB` (violet STEG)
- **Border radius :** 16px (cartes)
- **Sidebar :** 260px (réduite 72px), responsive
- **Header :** Fixe avec effet glassmorphism (backdrop-filter)
- **Tables :** En-têtes sticky, lignes alternées
- **Responsive :** Breakpoints 1440px, 1024px, 768px, 576px, 400px

---

## 6. Frontweb — Angular 22

### 6.1 Vue d'ensemble

Application Angular 22 pour les candidats. Portal public avec landing page, catalogue d'offres, suivi de candidatures, et interface d'entretien IA vocal avec vidéoconférence.

**Port de développement :** 4200

### 6.2 Structure

```
frontweb/src/
├── main.ts                           # Bootstrap (App, appConfig)
├── index.html                        # Shell HTML (lang="fr", police Inter)
├── styles.scss                       # Tokens CSS globaux
├── app/
│   ├── app.ts                        # Composant racine
│   ├── app.routes.ts                 # Toutes les routes
│   ├── app.config.ts                 # Providers (HttpClient, Router, interceptor)
│   ├── auth/
│   │   ├── guards/auth.guard.ts      # candidatGuard + guestGuard
│   │   ├── connexion/                # Page de connexion
│   │   ├── inscription/              # Page d'inscription
│   │   ├── verification-email/       # Vérification email
│   │   ├── mot-de-passe-oublie/      # Mot de passe oublié
│   │   └── reinitialiser-mot-de-passe/ # Réinitialisation
│   ├── core/
│   │   ├── models/landing.models.ts  # 30+ interfaces TypeScript
│   │   ├── services/                 # 7 services
│   │   ├── interceptors/             # JWT interceptor
│   │   └── utils/                    # Utilitaires dates, statuts
│   ├── landing/                      # Page d'accueil
│   │   ├── header/                   # Nav sticky responsive
│   │   ├── hero/                     # Bannière hero
│   │   ├── why-steg/                 # Section "Pourquoi STEG"
│   │   ├── stats/                    # Compteurs animés
│   │   ├── domains/                  # 6 domaines
│   │   ├── offers/                   # Dernières offres
│   │   └── footer/                   # Footer
│   ├── offers/                       # Offres de stage
│   │   ├── offers-page/              # Liste avec filtres
│   │   ├── offer-details/            # Détail type LinkedIn
│   │   └── pagination/               # Pagination numérotée
│   ├── profil/                       # Profil candidat
│   ├── mes-candidatures/             # Suivi des candidatures
│   ├── entretien-ia/                 # Entretien IA vocal
│   │   ├── entretien-ia.ts           # Interface vidéoconférence
│   │   ├── integrity-monitor.ts      # Anti-triche
│   │   └── device-fingerprint.ts     # Empreinte SHA-256
│   └── shared/                       # Composants partagés
│       ├── components/               # 7 composants
│       └── directives/               # reveal.directive.ts
```

### 6.3 Routes

| Route | Composant | Guard | Description |
|-------|-----------|-------|-------------|
| `/` | LandingPage | — | Page d'accueil publique |
| `/offres` | OffersPage | — | Catalogue d'offres |
| `/offres/:id` | OfferDetails | — | Détail d'une offre |
| `/connexion` | Connexion | guestGuard | Connexion |
| `/inscription` | Inscription | guestGuard | Inscription |
| `/verification-email` | VerificationEmail | — | Vérification email (token) |
| `/mot-de-passe-oublie` | MotDePasseOublie | guestGuard | Mot de passe oublié |
| `/reinitialiser-mot-de-passe` | ReinitialiserMotDePasse | — | Réinitialisation (token) |
| `/mon-profil` | Profil | candidatGuard | Profil candidat |
| `/mes-candidatures` | MesCandidatures | candidatGuard | Suivi candidatures |
| `/entretien-ia/:token` | EntretienIa | candidatGuard | Entretien IA vocal |

### 6.4 Composants principaux

| Composant | Description |
|-----------|-------------|
| **LandingPage** | Hero + Pourquoi STEG + Stats + Domaines + Offres + Footer |
| **OffersPage** | Recherche full-text, filtres (département, localisation, niveau, tri), pagination 9/page |
| **OfferDetails** | Page style LinkedIn : header, description, missions, compétences, technologies, CV upload + analyse IA, bouton postuler |
| **Profil** | Avatar, infos personnelles, éducation, compétences, langues, liens, changement mot de passe |
| **MesCandidatures** | Liste candidatures avec badges statut, HumanInterviewCard, StagePreferencesCard |
| **EntretienIa** | Interface vidéoconférence complète : phases (intro→parler→enregistrer→analyser→terminer), contrôles (micro, caméra, son, transcript), intégrité (fullscreen, tab switch, fingerprint) |

### 6.5 Intégrité — Système anti-triche

| Événement | Description | Poids |
|-----------|-------------|-------|
| `tab_switch` | Changement d'onglet | Élevé |
| `window_blur` | Perte de focus fenêtre | Élevé |
| `fullscreen_exit` | Sortie plein écran | Élevé |
| `camera_disabled` | Caméra désactivée | Élevé |
| `mic_disabled` | Microphone désactivé | Élevé |
| `network_interrupted` | Interruption réseau | Élevé |
| `devtools_open` | DevTools ouvertes | Élevé |
| `clipboard_paste` | Collage | Moyen |
| `right_click` | Clic droit | Faible |
| `keyboard_shortcut` | Raccourci clavier | Faible |
| `copy_event` | Copie | Faible |
| `video_off` | Vidéo coupée | Moyen |

Le score de risque est calculé et borné. Les violations déclenchent un overlay de suspension.

### 6.6 Services

| Service | Description |
|---------|-------------|
| `ApiService` | Client HTTP générique (get/post/put/delete/upload/blob) |
| `AuthService` | Connexion, inscription, vérification email, JWT |
| `TokenStorage` | Persistance JWT + utilisateur dans localStorage |
| `OffersService` | State management signals (recherche, filtres, tri, pagination) |
| `OffersApiService` | Appels API offres, candidatures, entretien IA |
| `CandidatService` | CRUD profil, upload photo/CV |
| `LandingService` | Données statiques landing page |

---

## 7. Application Mobile — Flutter

### 7.1 Vue d'ensemble

Application Flutter multiplateforme (iOS/Android) pour les stagiaires. Gère le suivi quotidien du stage : tâches assignées par l'encadrant, Kanban personnel, réunions, évaluations, journaux, et notifications push.

### 7.2 Structure

```
steg_app/lib/
├── main.dart                          # Point d'entrée, initialisation
├── core/
│   ├── routing/
│   │   ├── app_router.dart            # GoRouter configuration
│   │   └── route_paths.dart           # Chemins de routes
│   ├── theme/
│   │   └── app_colors.dart            # Palette de couleurs
│   ├── constants/
│   │   └── api_constants.dart         # URLs API
│   ├── network/
│   │   └── api_exception.dart         # Exceptions API
│   ├── storage/
│   │   └── secure_storage.dart        # Stockage sécurisé
│   ├── auth/
│   │   └── auth_provider.dart         # État d'authentification
│   ├── push/
│   │   └── push_notification_service.dart  # Firebase Messaging
│   └── utils/
│       ├── date_utils.dart            # Formatage dates
│       └── snackbar_utils.dart        # Snackbars
├── models/                            # 28 modèles Dart
├── services/                          # 18 services API
├── providers/                         # Providers Riverpod
├── screens/                           # 28 écrans
│   ├── auth/                          # Connexion, inscription
│   ├── home/                          # Accueil
│   ├── agenda/                        # Calendrier
│   ├── dashboard/                     # Tâches (officielles + personnelles)
│   ├── notifications/                 # Notifications
│   └── profil/                        # Profil
├── widgets/                           # 51 widgets réutilisables
│   ├── common/                        # Erreur, chargement, empty
│   ├── auth/                          # Formulaires auth
│   ├── home/                          # Cartes d'accueil
│   ├── dashboard/                     # Tâches, Kanban, Trello
│   └── profil/                        # Sections profil
└── assets/
    └── fonts/                         # Polices
```

### 7.3 Routing (GoRouter)

| Route | Écran | Description |
|-------|-------|-------------|
| `/connexion` | ConnexionScreen | Page de connexion |
| `/inscription` | InscriptionScreen | Page d'inscription |
| `/home` (ShellRoute) | HomeStagiaireView | Shell avec BottomNavigationBar |
| `/home/accueil` | AccueilStagiaireView | Tableau de bord |
| `/home/agenda` | AgendaView | Calendrier |
| `/home/taches` | MyTasksScreen | Tâches officielles + Kanban personnel |
| `/home/notifications` | NotificationsView | Notifications |
| `/home/profil` | ProfilStagiaireView | Profil |
| `/mon-profil` | ProfilStagiaireScreen | Profil détaillé (hors shell) |
| `/mon-projet` | StagiaireProjectScreen | Détail du projet |

### 7.4 Écrans principaux (28 écrans)

| Catégorie | Écrans |
|-----------|--------|
| **Auth** | ConnexionScreen, InscriptionScreen |
| **Home** | HomeStagiaireView, AccueilStagiaireView |
| **Agenda** | AgendaView |
| **Dashboard** | MyTasksScreen (tâches encadrant + Kanban personnel) |
| **Notifications** | NotificationsView |
| **Profil** | ProfilStagiaireView, ProfilStagiaireScreen |
| **Projet** | StagiaireProjectScreen |

### 7.5 Widgets (51 widgets)

| Catégorie | Widgets |
|-----------|---------|
| **Common** | ErrorView, LoadingView, EmptyState, CustomAppBar |
| **Auth** | LoginForm, RegisterForm |
| **Home** | StageCard, TaskSummaryCard, MeetingCard, QuickActionCard |
| **Dashboard** | TacheCard, TacheStatusWidgets, PersonalTacheCard, PersonalTacheForm, DashboardSkeletons |
| **Profil** | ProfileHeader, ProfileInfoSection, PasswordChangeSection |

### 7.6 Modèles (28 modèles)

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur de base |
| `Stagiaire` | Profil stagiaire |
| `Stage` | Stage actif |
| `Projet` | Projet de stage |
| `Tache` | Tâche assignée par l'encadrant |
| `PersonalTache` | Tâche personnelle Kanban (A_FAIRE/EN_COURS/TERMINEE) |
| `Reunion` | Réunion |
| `Evaluation` | Évaluation |
| `Journal` | Journal de bord |
| `Document` | Document de stage |
| `Notification` | Notification |
| `Candidature` | Candidature |
| `OffreStage` | Offre de stage |
| `Departement` | Département |
| `Encadrant` | Encadrant |
| `Candidat` | Candidat |
| `AiInterviewSession` | Session entretien IA |
| `HumanInterview` | Entretien humain |
| `CandidatureDocument` | Document d'onboarding |
| `CvAnalyse` | Analyse CV IA |
| `DeviceToken` | Token FCM |
| `LoginResponse` | Réponse de connexion |
| `RegisterPayload` | Données d'inscription |
| `DashboardStats` | Statistiques dashboard |
| `TacheStatut` | Enum statuts tâches |
| `TachePriorite` | Enum priorités tâches |
| `PersonalTacheStatut` | Enum statuts Kanban |

### 7.7 Services API (18 services)

| Service | Endpoints |
|---------|-----------|
| `AuthService` | `/auth/login`, `/auth/register`, `/auth/me` |
| `StageService` | `/stages/mes-stages` |
| `ProjetService` | `/projets` |
| `TacheService` | `/taches/mes-taches` |
| `PersonalTacheService` | `/personal-taches` (CRUD + move + counts) |
| `ReunionService` | `/reunions` |
| `EvaluationService` | `/evaluations` |
| `JournalService` | `/journaux/mes-journaux` |
| `DocumentService` | `/documents` |
| `NotificationService` | `/notifications` |
| `CandidatService` | `/candidat` |
| `OffreService` | `/offres` |
| `DepartementService` | `/departements` |
| `ProfileService` | `/auth/profile` |
| `DashboardService` | `/dashboard/stats` |
| `SearchService` | `/search` |
| `AiInterviewService` | `/entretien-ia` |
| `HumanInterviewService` | `/candidatures/:id/entretien-humain` |

### 7.8 Kanban personnel (Trello-like)

Le `MyTasksScreen` contient deux sections :
1. **Tâches de l'encadrant** — Liste en lecture seule, filtrable par statut
2. **Mon tableau personnel** — Board Kanban avec 3 colonnes (À faire, En cours, Terminée) supportant le Drag & Drop entre colonnes via `LongPressDraggable` + `DragTarget`

---

## 8. Service IA — Python / FastAPI

### 8.1 Vue d'ensemble

Microservice Python pour les fonctionnalités d'intelligence artificielle :
- **Entretien IA vocal** — Questions dynamiques, scoring, rapport d'évaluation
- **Text-to-Speech (TTS)** — 4 fournisseurs (OpenAI, edge-tts, système, mock)
- **Speech-to-Text (STT)** — 2 fournisseurs (OpenAI Whisper, mock)
- **Vérification de documents** — Analyse de CV, CIN, demande de stage, lettre d'affectation

**Port :** 8001 — Appelé uniquement server-to-server par le Backend Node.js.

### 8.2 Endpoints

| Méthode | Path | Auth | Description |
|---------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/tts/synthesize` | `X-Service-Token` | Synthèse vocale (TTS) |
| POST | `/api/stt/transcribe` | `X-Service-Token` | Transcription audio (STT) |
| POST | `/api/v1/interviews` | `X-Service-Token` | Créer session entretien |
| GET | `/api/v1/interviews/{id}` | `X-Service-Token` | Détails session |
| POST | `/api/v1/interviews/{id}/start` | `X-Service-Token` | Démarrer (1ère question) |
| POST | `/api/v1/interviews/{id}/answer` | `X-Service-Token` | Soumettre réponse |
| POST | `/api/v1/interviews/{id}/complete` | `X-Service-Token` | Terminer + rapport |
| GET | `/api/v1/interviews/{id}/report` | `X-Service-Token` | Rapport d'évaluation |
| POST | `/api/documents/verify` | `X-Service-Token` | Vérification document |

### 8.3 Moteur d'entretien IA

**Nombre de questions :** 8 par session

**Catégories de questions :**

| # | Catégorie | Poids scoring | Exemple |
|---|-----------|---------------|---------|
| 1 | PRÉSENTATION | — | "Présentez-vous brièvement" |
| 2 | MOTIVATION | 0.20 | "Pourquoi ce stage ?" |
| 3 | FORMATION | 0.15 | "Décrivez votre parcours" |
| 4 | TECHNIQUE | 0.25 | Questions sur les technologies de l'offre |
| 5 | EXPÉRIENCE | 0.15 | "Décrivez un projet réalisé" |
| 6 | RÉSOLUTION | 0.10 | "Comment résoudriez-vous..." |
| 7 | ÉQUIPE | 0.05 | "Travaillez-vous en équipe ?" |
| 8 | OFFRE_SPÉCIFIQUE | 0.10 | Questions sur les missions de l'offre |

**Score d'évaluation :**
- `score_global` (0-100)
- `compatibilite_offre` (0-100)
- `competences_techniques` (0-100)
- `motivation` (0-100)
- `communication` (0-100)
- `recommendation` : FAVORABLE (≥70), À_REVOIR (≥50), DÉFAVORABLE (<50)

### 8.4 Fournisseurs TTS

| Fournisseur | Sortie | Notes |
|-------------|--------|-------|
| OpenAI | MP3 | Clé API requise, modèle `tts-1` |
| edge-tts | MP3 | Gratuit, voix neurales Microsoft, `fr-FR-DeniseNeural` |
| Système | WAV | macOS `say` ou `espeak-ng` |
| Mock | WAV | Génère une onde sinusoïdale |

### 8.5 Fournisseurs STT

| Fournisseur | Notes |
|-------------|-------|
| OpenAI Whisper | Clé API requise, modèle `whisper-1`, langue `fr` |
| Mock | Retourne une phrase française hardcodée |

### 8.6 Vérification de documents

**Types de documents supportés :** CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION

**Logique de décision (scoring de confiance) :**

| Critère | Points |
|---------|--------|
| Texte lisible | +30 |
| OCR image | +10 |
| Type de document détecté | +35 |
| Nom complet correspondant | +20 |
| Informations requises présentes | +15 |
| Cohérence parfaite (bonus) | +10 |
| **Maximum** | **95** (jamais 100%) |

**Verdict :**
- `VALID` : confiance ≥ 85
- `REVIEW_REQUIRED` : confiance ≥ 50
- `REJECTED` : confiance < 50

---

## 9. Flux métier principaux

### 9.1 Pipeline Candidature → Stagiaire

```
CANDIDAT postule
    │
    ▼
EN_ATTENTE (candidature créée)
    │
    ▼
CHEF_DEPARTEMENT pré-sélectionne
    │
    ▼
PRESELECTIONNE → CANDIDAT accepte/refuse
    │
    ▼ (si accepté)
PREselection_ACCEPTEE
    │
    ▼
Entretien IA déclenché (score ≥ seuil = AI_INTERVIEW_PASSED)
    │
    ▼
Entretien humain planifié par RH
    │
    ▼
RH interviewe → Décision (ACCEPTED / REJECTED)
    │
    ▼ (si ACCEPTED)
Période de stage validée par RH
    │
    ▼
4 documents onboarding vérifiés (CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION)
    │  ↑ Upload candidat → Vérification IA → Décision RH
    │
    ▼ (tous VALIDATED)
READY_FOR_TRAINEE
    │
    ▼
RH convertit en stagiaire
    │
    ▼
Création automatique : rôle STAGIAIRE + stage + projet
```

### 9.2 Entretien IA vocal

```
1. CANDIDAT accède via token unique
2. Vérification micro + caméra
3. Question 1 : Présentation (TTS → audio)
4. CANDIDAT répond en audio (MediaRecorder)
5. Audio → STT (transcription texte)
6. Réponse → Analyse IA (qualité, mots-clés, technologies)
7. Questions 2-8 : Dynamiques selon les réponses précédentes
8. Score calculé (8 catégories × poids)
9. Rapport généré (score_global, recommendation, points forts/faibles)
10. Statut mis à jour dans la candidature
```

### 9.3 Vérification document d'onboarding

```
1. CANDIDAT upload un document (PDF/DOCX/DOC/IMG)
2. Backend déclenche vérification IA (POST /api/documents/verify)
3. Service Python :
   a. Extraction du texte (pypdf, python-docx, OCR)
   b. Détection du type de document (mots-clés pondérés)
   c. Vérification du nom du candidat
   d. Vérification des informations requises (CIN number, formation, etc.)
   e. Calcul du score de confiance
   f. Verdict : VALID / REVIEW_REQUIRED / REJECTED
4. RH reçoit le résultat et prend la décision finale
5. Les 4 documents doivent être VALIDATED pour convertir en stagiaire
```

### 9.4 Gestion des tâches

**Tâches officielles (encadrant → stagiaire) :**
- L'encadrant crée des tâches dans un projet
- Le stagiaire met à jour la progression (0-100%)
- Quand toutes les tâches sont terminées, le stage passe automatiquement à TERMINE
- La progression se synchronise avec l'avancement du projet

**Tâches personnelles (Kanban du stagiaire) :**
- Le stagiaire crée ses propres tâches
- Tableau Kanban 3 colonnes : À faire → En cours → Terminée
- Drag & Drop pour déplacer entre colonnes
- Positions gérées par le backend (réordonnancement automatique)

---

## 10. Schéma de la base de données

### 10.1 Diagramme des relations

```
utilisateur ──┬── administrateur
              ├── chef_departement ── departement
              ├── rh
              ├── encadrant
              ├── stagiaire
              └── candidat
                     │
                     ├── candidature ──┬── stage ──┬── projet ── tache
                     │                 │          ├── reunion
                     │                 │          ├── evaluation
                     │                 │          ├── journal
                     │                 │          └── document
                     │                 ├── ai_interview_session
                     │                 ├── human_interview
                     │                 └── candidature_document
                     └── cv_analyse

offre_stage ── departement
stage ── stagiaire, encadrant, candidature
notification ── utilisateur
tache_personnelle ── stagiaire
device_token ── stagiaire
permission ── utilisateur_permission ── utilisateur
```

### 10.2 Tables principales avec colonnes clés

#### `utilisateur`
| Colonne | Type | Contrainte |
|---------|------|------------|
| id | UUID | PRIMARY KEY |
| nom | VARCHAR(100) | NOT NULL |
| prenom | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| mot_de_passe | VARCHAR(255) | NOT NULL |
| role | role_utilisateur | NOT NULL |
| statut | VARCHAR(20) | DEFAULT 'actif' |
| token_version | INTEGER | DEFAULT 0 |
| email_verified | BOOLEAN | DEFAULT FALSE |
| deleted_at | TIMESTAMP | NULLABLE |

#### `candidature`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| candidat_id | UUID | FK → candidat |
| offre_id | UUID | FK → offre_stage |
| statut | statut_candidature | Enum |
| date_candidature | TIMESTAMP | Date de candidature |
| ai_interview_score | DECIMAL | Score entretien IA |
| ai_interview_status | VARCHAR | Statut entretien IA |
| human_interview_status | VARCHAR | Statut entretien humain |
| onboarding_status | statut_onboarding | Statut onboarding |
| internship_start_date | DATE | Date début stage |
| internship_duration_months | INTEGER | Durée en mois |

#### `stage`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| candidature_id | UUID | FK → candidature |
| stagiaire_id | UUID | FK → stagiaire |
| encadrant_id | UUID | FK → encadrant |
| date_debut | DATE | Date début |
| date_fin | DATE | Date fin |
| statut | statut_stage | Enum |
| projet_id | UUID | FK → projet |

#### `tache`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| projet_id | UUID | FK → projet |
| titre | VARCHAR(255) | Titre |
| description | TEXT | Description |
| statut | statut_tache | Enum |
| priorite | VARCHAR(20) | BASSE, MOYENNE, HAUTE, URGENTE |
| date_debut | DATE | Date début |
| date_fin | DATE | Date fin |
| avancement | INTEGER | 0-100 |

#### `tache_personnelle`
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| stagiaire_id | UUID | FK → stagiaire |
| titre | VARCHAR(255) | Titre |
| description | TEXT | Description |
| statut | statut_tache | A_FAIRE, EN_COURS, TERMINEE |
| priorite | VARCHAR(20) | Priorité |
| date_echeance | DATE | Date d'échéance |
| position | INTEGER | Position dans la colonne |
| created_at | TIMESTAMP | Créé le |
| updated_at | TIMESTAMP | Mis à jour le |

---

## 11. Référence API complète

### 11.1 Nombre total d'endpoints par service

| Service | Nombre d'endpoints |
|---------|-------------------|
| Backend Node.js | ~85 |
| AI Service Python | 10 |
| **Total** | **~95** |

### 11.2 Endpoints par groupe

| Groupe | GET | POST | PUT | PATCH | DELETE | Total |
|--------|-----|------|-----|-------|--------|-------|
| Auth | 1 | 5 | 2 | — | — | 8 |
| Candidat | 3 | 2 | 2 | — | 1 | 8 |
| Candidats (gestion) | 2 | — | — | — | — | 2 |
| Offres | 2 | 1 | 1 | — | 1 | 5 |
| Candidatures | 5 | 8 | 2 | — | 2 | 17 |
| Entretien IA (legacy) | 2 | 7 | — | — | — | 9 |
| Entretien IA (engine) | 2 | 4 | — | — | — | 6 |
| Stages | 7 | — | 1 | — | — | 8 |
| Tâches | 3 | 1 | 1 | — | 1 | 6 |
| Tâches personnelles | 2 | 1 | 1 | 1 | — | 5* |
| Réunions | 2 | 1 | — | — | 1 | 4 |
| Évaluations | 2 | 1 | 1 | — | — | 4 |
| Journaux | 3 | 1 | 1 | — | — | 5 |
| Notifications | 1 | — | 2 | — | — | 3 |
| Documents | 2 | 1 | — | — | 1 | 4 |
| Dashboard | 3 | — | — | — | — | 3 |
| Recherche | 1 | — | — | — | — | 1 |
| Public | 3 | — | — | — | — | 3 |
| Départements | 2 | 1 | 1 | — | 1 | 5 |
| Encadrants | 2 | 1 | 1 | — | 1 | 5 |
| Stagiaires | 2 | 1 | 1 | — | 1 | 5 |
| **Backend Total** | **~54** | **~34** | **~14** | **~1** | **~8** | **~85** |

*\*Le PATCH est utilisé pour `/personal-taches/:id/move`*

### 11.3 Réponses API standard

**Succès :**
```json
{
  "success": true,
  "data": { ... }
}
```

**Erreur :**
```json
{
  "success": false,
  "message": "Description de l'erreur",
  "errors": [
    { "field": "email", "message": "Email invalide" }
  ]
}
```

### 11.4 Pagination

Les endpoints de liste supportent la pagination :
```
GET /api/candidatures?page=1&limit=20&search=ter&statut=ACCEPTEE
```

Réponse :
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "pages": 8
}
```

---

## 12. Sécurité et authentification

### 12.1 Authentification

- **JWT** (JSON Web Token) avec expiration configurable
- **Token versioning** pour invalidation (changement de mot de passe incrémente `token_version`)
- **bcrypt** pour le hachage des mots de passe
- **Rate limiting** : 1000 req/15min (général), 50 req/15min (auth)

### 12.2 Autorisation (RBAC)

| Mécanisme | Implémentation |
|-----------|----------------|
| JWT Bearer | Middleware `auth` — vérifie le token, charge `req.user` |
| Rôles | Middleware `role(...roles)` — vérifie le rôle |
| Scope | Middleware `withScope` — filtre SQL selon le rôle |
| Ownership | `authorizeResource` — vérifie propriétaire ou admin |
| Stage-specific | `authorizeStage` — accès selon le rôle pour les stages |

### 12.3 Sécurité physique

| Mesure | Détail |
|--------|--------|
| Helmet | En-têtes HTTP de sécurité |
| CORS | Origines configurables |
| Rate Limiting | Protection contre les attaques par force brute |
| Validation | express-validator sur toutes les routes |
| Upload | Taille max (5MB CV, 10MB documents), types autorisés |
| Chiffrement mobile | AES-256-GCM pour les identifiants temporaires |
| Intégrité IA | Scoring anti-triche (tab switch, clipboard, DevTools, etc.) |
| Service-to-service | Token `X-Service-Token` pour communication Backend ↔ AI Service |

### 12.4 Données sensibles

| Donnée | Protection |
|--------|------------|
| Mots de passe | bcrypt (10 rounds) |
| JWT Secret | Variable d'environnement |
| Clés API | Variables d'environnement, jamais en dur |
| Credentials mobile | Chiffrement AES-256-GCM |
| Empreinte device | Hash SHA-256, non stocké |
| Documents | Vérification IA sans stockage de données personnelles dans les réponses |

---

## 13. Guide d'installation et de déploiement

### 13.1 Prérequis

| Composant | Version requise |
|-----------|-----------------|
| Node.js | LTS (18+) |
| Python | 3.10+ |
| PostgreSQL | 14+ |
| Flutter SDK | 3.x |
| Angular CLI | 22.x |
| Yarn | 4.x (backoffice) |
| npm | 10+ (frontweb) |

### 13.2 Démarrage rapide

#### 1. Base de données PostgreSQL

```bash
# Créer la base
createdb -h localhost -p 5433 -U postgres steg_stage

# Exécuter le schéma
psql -h localhost -p 5433 -U postgres -d steg_stage -f backend/database/schema.sql

# Exécuter les migrations
cd backend && node database/migrate.js

# (Optionnel) Données de démo
psql -h localhost -p 5433 -U postgres -d steg_stage -f backend/database/mock_demo.sql
```

#### 2. Backend Node.js

```bash
cd backend
npm install
cp .env.example .env  # Configurer les variables
node server.js        # Démarrage sur port 3000
```

#### 3. Service IA Python

```bash
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configurer les variables
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### 4. Backoffice Angular

```bash
cd backoffice
yarn install
yarn start            # Démarrage sur port 4400
```

#### 5. Frontweb Angular

```bash
cd frontweb
npm install
ng serve              # Démarrage sur port 4200
```

#### 6. Application Mobile Flutter

```bash
cd steg_app
flutter pub get
flutter run            # iOS/Android simulator
```

### 13.3 Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3000 | http://localhost:3000 |
| AI Service | 8001 | http://localhost:8001 |
| Frontweb | 4200 | http://localhost:4200 |
| Backoffice | 4400 | http://localhost:4400 |
| PostgreSQL | 5433 | localhost:5433 |

### 13.4 Comptes de démonstration

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| admin@steg.tn | ADMIN | admin123 |
| ahmed.bensalah@steg.tn | ENCADRANT | encadrant123 |
| fatma.trabelsi@steg.tn | STAGIAIRE | stagiaire123 |
| mohamed.bouchnak@steg.tn | STAGIAIRE | stagiaire123 |
| nesrine.derouiche@steg.tn | STAGIAIRE | StegIntern2026! |

### 13.5 Tests

```bash
# Backend (Jest)
cd backend && npx jest --verbose

# AI Service (pytest)
cd ai-service && source venv/bin/activate && pytest

# Backoffice (Vitest)
cd backoffice && yarn test

# Frontweb (Vitest)
cd frontweb && ng test

# Flutter
cd steg_app && flutter test
```

---

## Annexe A — Fichiers clés du projet

### Backend
- `backend/server.js` — Point d'entrée
- `backend/config/db.js` — Pool PostgreSQL + `withTransaction()`
- `backend/database/schema.sql` — Schéma complet
- `backend/routes/index.js` — Montage des routes
- `backend/services/candidature.service.js` — Logique métier candidature
- `backend/services/ai-interview.service.js` — Entretien IA legacy
- `backend/services/personal-tache.service.js` — Tâches personnelles Kanban
- `backend/services/authorization.service.js` — RBAC
- `backend/middlewares/auth.middleware.js` — Authentification JWT

### Backoffice
- `backoffice/src/app/app-routing.module.ts` — Routes
- `backoffice/src/app/core/data/auth.service.ts` — Auth
- `backoffice/src/app/demo/dashboard/default/default.component.ts` — Dashboard adaptatif
- `backoffice/src/scss/custom-steg.scss` — Design system

### Frontweb
- `frontweb/src/app/app.routes.ts` — Routes
- `frontweb/src/app/core/services/api.service.ts` — Client HTTP
- `frontweb/src/app/core/services/offers-api.service.ts` — API offres
- `frontweb/src/app/entretien-ia/entretien-ia.ts` — Interface IA

### Flutter
- `steg_app/lib/main.dart` — Point d'entrée
- `steg_app/lib/core/routing/app_router.dart` — GoRouter
- `steg_app/lib/screens/dashboard/my_tasks_screen.dart` — Kanban personnel
- `steg_app/lib/providers/personal_tache/personal_tache_providers.dart` — State Kanban

### AI Service
- `ai-service/app/main.py` — FastAPI app
- `ai-service/app/services/interview_engine.py` — Moteur d'entretien
- `ai-service/app/services/document_verification.py` — Vérification documents
- `ai-service/app/services/text_to_speech.py` — TTS multi-fournisseurs

---

> **Document généré automatiquement — Septembre 2026**
> STEG Internship Platform — Société Tunisienne de l'Électricité et du Gaz
