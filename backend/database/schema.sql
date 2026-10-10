-- ============================================================================
-- SYSTEME DE GESTION DES STAGES - STEG
-- Script DDL PostgreSQL
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. TYPES ENUMERES
CREATE TYPE role_utilisateur AS ENUM (
    'ADMIN', 'STAGIAIRE', 'ENCADRANT', 'CHEF_DEPARTEMENT', 'RH', 'CANDIDAT'
);

CREATE TYPE statut_candidature AS ENUM (
    'EN_ATTENTE', 'EN_ENTRETIEN_IA', 'RH_ACCEPTED', 'ACCEPTEE', 'REFUSEE',
    'AI_INTERVIEW_PASSED', 'AI_INTERVIEW_FAILED', 'EN_ENTRETIEN_HUMAIN',
    'HUMAN_INTERVIEW_COMPLETED', 'HUMAN_INTERVIEW_ACCEPTED', 'HUMAN_INTERVIEW_REJECTED',
    'STAGIAIRE_CREATED'
);

CREATE TYPE statut_stage AS ENUM (
    'EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE', 'EN_ATTENTE'
);

CREATE TYPE statut_offre AS ENUM (
    'OUVERTE', 'FERMEE', 'EXPIREE', 'POURVUE'
);

CREATE TYPE type_document AS ENUM (
    'CV', 'CONVENTION', 'ASSURANCE', 'RAPPORT', 'ATTESTATION'
);

CREATE TYPE type_rapport AS ENUM (
    'INTERMEDIAIRE', 'FINAL'
);

CREATE TYPE priorite_tache AS ENUM (
    'BASSE', 'MOYENNE', 'HAUTE', 'URGENTE'
);

CREATE TYPE statut_tache AS ENUM (
    'A_FAIRE', 'EN_COURS', 'TERMINEE', 'BLOQUEE'
);

CREATE TYPE statut_rapport AS ENUM (
    'SOUMIS', 'EN_REVISION', 'VALIDE', 'REJETE'
);

CREATE TYPE statut_journal AS ENUM (
    'BROUILLON', 'SOUMIS', 'VALIDE', 'REJETE'
);

CREATE TYPE statut_entretien_ia AS ENUM (
    'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ABANDONNE'
);

-- 3. UTILISATEUR ET HERITIERS
CREATE TABLE utilisateur (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom             VARCHAR(100)        NOT NULL,
    prenom          VARCHAR(100)        NOT NULL,
    email           VARCHAR(255)        NOT NULL UNIQUE,
    mot_de_passe    VARCHAR(255)        NOT NULL,
    telephone       VARCHAR(30),
    date_creation   TIMESTAMPTZ         NOT NULL DEFAULT now(),
    role            role_utilisateur    NOT NULL,
    actif           BOOLEAN             NOT NULL DEFAULT true,
    token_version   INTEGER             NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    adresse                           VARCHAR(255),
    email_verifie     BOOLEAN           NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires_at TIMESTAMPTZ,
    reset_token       VARCHAR(255),
    reset_token_expires_at TIMESTAMPTZ
);

CREATE TABLE administrateur (
    id  UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE
);

CREATE TABLE rh (
    id  UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE
);

CREATE TABLE chef_departement (
    id  UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE
);

CREATE TABLE stagiaire (
    id              UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    ecole           VARCHAR(255),
    specialite      VARCHAR(150),
    niveau          VARCHAR(50),
    competences     TEXT,
    disponibilite   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE encadrant (
    id                      UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    service                 VARCHAR(150),
    nombre_max_stagiaires   INTEGER NOT NULL DEFAULT 3 CHECK (nombre_max_stagiaires >= 0),
    competences             TEXT,
    disponibilite           BOOLEAN NOT NULL DEFAULT true
);

-- Candidat (portail public) — même utilisateur que stagiaire ou isolé
CREATE TABLE candidat (
    id              UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
    universite      VARCHAR(255),
    specialite      VARCHAR(150),
    niveau          VARCHAR(50),
    competences     TEXT,
    langues         VARCHAR(255),
    github          VARCHAR(255),
    linkedin        VARCHAR(255),
    portfolio       VARCHAR(255),
    photo_path      VARCHAR(500),
    cv_path         VARCHAR(500),
    cv_original_name VARCHAR(255),
    cv_size         BIGINT,
    cv_uploaded_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PERMISSIONS
CREATE TABLE permission (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT
);

CREATE TABLE utilisateur_permission (
    utilisateur_id  UUID NOT NULL REFERENCES utilisateur(id)  ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permission(id)   ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, permission_id)
);

-- 5. DEPARTEMENTS
CREATE TABLE departement (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom                     VARCHAR(150) NOT NULL UNIQUE,
    description             TEXT,
    chef_departement_id     UUID UNIQUE REFERENCES chef_departement(id) ON DELETE SET NULL
);

ALTER TABLE encadrant
    ADD COLUMN departement_id UUID REFERENCES departement(id) ON DELETE SET NULL;

-- 6. OFFRES DE STAGE
CREATE TABLE offre_stage (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    departement_id          UUID NOT NULL REFERENCES departement(id) ON DELETE CASCADE,
    titre                   VARCHAR(200) NOT NULL,
    description             TEXT,
    duree                   INTEGER NOT NULL CHECK (duree > 0),
    competences_demandees   TEXT,
    nombre_places           INTEGER NOT NULL CHECK (nombre_places > 0),
    date_limite             DATE NOT NULL,
    statut                  statut_offre NOT NULL DEFAULT 'OUVERTE',
    missions                TEXT,
    technologies            VARCHAR(500),
    documents_demandes      TEXT,
    localisation            VARCHAR(150),
    niveau                  VARCHAR(50),
    encadrant_id            UUID REFERENCES encadrant(id) ON DELETE SET NULL
);

-- 7. CANDIDATURES
CREATE TABLE candidature (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stagiaire_id        UUID REFERENCES stagiaire(id)   ON DELETE CASCADE,
    candidat_id         UUID REFERENCES candidat(id)    ON DELETE CASCADE,
    offre_id            UUID NOT NULL REFERENCES offre_stage(id) ON DELETE CASCADE,
    date_candidature    TIMESTAMPTZ NOT NULL DEFAULT now(),
    statut              statut_candidature NOT NULL DEFAULT 'EN_ATTENTE',
    deleted_at          TIMESTAMPTZ,
    -- Préférences de stage choisies par le candidat accepté (post-entretien humain).
    internship_start_date           DATE,
    internship_duration_months      INTEGER,
    internship_details_submitted_at TIMESTAMPTZ,
    internship_period_validated_at  TIMESTAMPTZ,
    internship_period_validated_by  UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
    internship_modification_requested_at TIMESTAMPTZ,
    mobile_access_prepared_at        TIMESTAMPTZ,
    mobile_access_email_state        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    mobile_access_email_sent_at      TIMESTAMPTZ,
    mobile_access_email_error        VARCHAR(500),
    mobile_access_credentials_encrypted TEXT,
    -- Décision finale RH (trace sur la candidature)
    decision            VARCHAR(30),
    decided_by          UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
    decided_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_candidature_unique_active ON candidature(stagiaire_id, offre_id) WHERE deleted_at IS NULL AND candidat_id IS NULL;
CREATE UNIQUE INDEX idx_candidature_unique_candidat ON candidature(candidat_id, offre_id) WHERE deleted_at IS NULL AND candidat_id IS NOT NULL;

-- Documents requis du dossier de candidature (onboarding, pré-création du stage)
CREATE TABLE candidature_document (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id  UUID NOT NULL REFERENCES candidature(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL
                    CHECK (type IN ('CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION')),
    nom             VARCHAR(255) NOT NULL,
    chemin          VARCHAR(500) NOT NULL,
    date_depot      TIMESTAMPTZ NOT NULL DEFAULT now(),
    statut          VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                    CHECK (statut IN ('MANQUANT', 'EN_ATTENTE', 'VALIDE', 'REJETE')),
    rejected_reason VARCHAR(500),
    -- Verdict de vérification automatique (service d'analyse documentaire) :
    -- indépendant de `statut` (workflow RH), NULL tant que la vérification n'a pas débuté.
    verification_status VARCHAR(20)
                    CHECK (verification_status IN ('PENDING', 'VALID', 'REVIEW_REQUIRED', 'REJECTED'))
);
CREATE UNIQUE INDEX idx_candidature_document_unique ON candidature_document(candidature_id, type);
CREATE INDEX idx_candidature_document_candidature ON candidature_document(candidature_id);

-- Historique d'audit des décisions RH (décision, RH, horodatage, statuts)
CREATE TABLE candidature_decisions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id  UUID NOT NULL REFERENCES candidature(id) ON DELETE CASCADE,
    decision        VARCHAR(30) NOT NULL,
    decided_by      UUID NOT NULL REFERENCES utilisateur(id) ON DELETE SET NULL,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_status VARCHAR(50) NOT NULL,
    new_status      VARCHAR(50) NOT NULL,
    action          VARCHAR(50),
    internship_start_date DATE,
    internship_duration_months INTEGER,
    -- Décision RH de vérification d'un document du dossier (document_id nullable :
    -- les décisions de candidature / période de stage n'y sont pas rattachées)
    document_id      UUID REFERENCES candidature_document(id) ON DELETE SET NULL
);
CREATE INDEX idx_candidature_decisions_candidature ON candidature_decisions(candidature_id);

-- 8. STAGE
CREATE TABLE stage (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id  UUID NOT NULL UNIQUE REFERENCES candidature(id) ON DELETE RESTRICT,
    stagiaire_id    UUID NOT NULL REFERENCES stagiaire(id)   ON DELETE RESTRICT,
    encadrant_id    UUID NOT NULL REFERENCES encadrant(id)   ON DELETE RESTRICT,
    departement_id  UUID NOT NULL REFERENCES departement(id) ON DELETE RESTRICT,
    offre_id        UUID NOT NULL REFERENCES offre_stage(id) ON DELETE RESTRICT,
    date_debut      DATE NOT NULL,
    date_fin        DATE NOT NULL,
    statut          statut_stage NOT NULL DEFAULT 'EN_COURS',
    CHECK (date_fin > date_debut)
);

-- 9. PROJETS
CREATE TABLE projet (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        UUID NOT NULL UNIQUE REFERENCES stage(id) ON DELETE CASCADE,
    titre           VARCHAR(200) NOT NULL,
    description     TEXT,
    technologies    TEXT,
    etat            VARCHAR(50) NOT NULL DEFAULT 'EN_COURS',
    avancement      SMALLINT NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100)
);

-- 10. TACHES
CREATE TABLE tache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projet_id       UUID NOT NULL REFERENCES projet(id)     ON DELETE CASCADE,
    createur_id     UUID NOT NULL REFERENCES encadrant(id)  ON DELETE RESTRICT,
    executant_id    UUID NOT NULL REFERENCES stagiaire(id)  ON DELETE RESTRICT,
    titre           VARCHAR(200) NOT NULL,
    description     TEXT,
    priorite        priorite_tache NOT NULL DEFAULT 'MOYENNE',
    date_debut      DATE,
    date_fin        DATE,
    statut          statut_tache NOT NULL DEFAULT 'A_FAIRE',
    progress        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completion_date TIMESTAMPTZ,
    estimated_hours INTEGER NOT NULL DEFAULT 1 CHECK (estimated_hours > 0),
    spent_hours     INTEGER NOT NULL DEFAULT 0 CHECK (spent_hours >= 0),
    CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut),
    CHECK (progress BETWEEN 0 AND 100)
);

-- 11. DOCUMENTS
CREATE TABLE document (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stagiaire_id    UUID NOT NULL REFERENCES stagiaire(id) ON DELETE CASCADE,
    stage_id        UUID REFERENCES stage(id) ON DELETE CASCADE,
    type            type_document NOT NULL,
    nom             VARCHAR(255) NOT NULL,
    chemin          VARCHAR(500) NOT NULL,
    date_depot      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. RAPPORTS
CREATE TABLE rapport (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        UUID NOT NULL REFERENCES stage(id) ON DELETE CASCADE,
    type            type_rapport NOT NULL,
    contenu         TEXT,
    date            TIMESTAMPTZ NOT NULL DEFAULT now(),
    statut          statut_rapport NOT NULL DEFAULT 'SOUMIS',
    commentaire     TEXT
);

-- 13. EVALUATIONS
CREATE TABLE evaluation (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        UUID NOT NULL REFERENCES stage(id)     ON DELETE CASCADE,
    encadrant_id    UUID NOT NULL REFERENCES encadrant(id) ON DELETE RESTRICT,
    technique       SMALLINT NOT NULL CHECK (technique     BETWEEN 0 AND 20),
    communication   SMALLINT NOT NULL CHECK (communication BETWEEN 0 AND 20),
    autonomie       SMALLINT NOT NULL CHECK (autonomie     BETWEEN 0 AND 20),
    ponctualite     SMALLINT NOT NULL CHECK (ponctualite   BETWEEN 0 AND 20),
    qualite         SMALLINT NOT NULL CHECK (qualite       BETWEEN 0 AND 20),
    note_finale     NUMERIC(4,2) NOT NULL CHECK (note_finale BETWEEN 0 AND 20),
    commentaire     TEXT,
    date_evaluation TIMESTAMPTZ NOT NULL DEFAULT now(),
    validee         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. REUNIONS
CREATE TABLE reunion (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id        UUID NOT NULL REFERENCES stage(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    heure           TIME NOT NULL,
    salle           VARCHAR(100),
    lien_visio      VARCHAR(500),
    sujet           VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. JOURNAUX HEBDOMADAIRES
CREATE TABLE journal (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id              UUID NOT NULL REFERENCES stage(id) ON DELETE CASCADE,
    semaine               DATE NOT NULL,
    travaux               TEXT NOT NULL,
    difficultes           TEXT,
    solutions             TEXT,
    competences           TEXT,
    heures                NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (heures >= 0 AND heures <= 168),
    commentaire           TEXT,
    statut                statut_journal NOT NULL DEFAULT 'BROUILLON',
    commentaire_encadrant TEXT,
    date_soumission       TIMESTAMPTZ,
    date_validation       TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (stage_id, semaine)
);

-- 16. NOTIFICATIONS
CREATE TABLE notification (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id  UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    titre           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    date            TIMESTAMPTZ NOT NULL DEFAULT now(),
    type            VARCHAR(50) NOT NULL DEFAULT 'INFO',
    lue             BOOLEAN NOT NULL DEFAULT false,
    lien            VARCHAR(500)
);

-- 17. DEVICE TOKENS (notifications push)
CREATE TABLE device_token (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    utilisateur_id  UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    token           VARCHAR(500) NOT NULL UNIQUE,
    platform        VARCHAR(20) NOT NULL DEFAULT 'android',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. ANALYSE CV
CREATE TABLE cv_analyse (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidat_id   UUID NOT NULL REFERENCES candidat(id) ON DELETE CASCADE,
    cv_filename   VARCHAR(500),
    statut        VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
    resultat      JSONB,
    ai_provider   VARCHAR(50),
    erreur        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. ENTRETIEN IA : SESSIONS, QUESTIONS, RÉPONSES
CREATE TABLE ai_interview_sessions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id     UUID NOT NULL UNIQUE REFERENCES candidature(id) ON DELETE CASCADE,
    token              VARCHAR(100) NOT NULL UNIQUE,
    statut             statut_entretien_ia NOT NULL DEFAULT 'EN_ATTENTE',
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    evaluation_status  VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                       CHECK (evaluation_status IN ('EN_ATTENTE', 'EVALUEE', 'INDISPONIBLE')),
    evaluation         JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    python_session_id  VARCHAR(64),
    integrity_events   JSONB NOT NULL DEFAULT '[]',
    integrity_devices  JSONB,
    device_fingerprint VARCHAR(512),
    device_checks      SMALLINT NOT NULL DEFAULT 0,
    device_fingerprint_changed BOOLEAN NOT NULL DEFAULT false,
    integrity_risk_score SMALLINT NOT NULL DEFAULT 0,
    integrity_risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW'
                       CHECK (integrity_risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    integrity_flags    JSONB NOT NULL DEFAULT '[]',
    integrity_computed_at TIMESTAMPTZ
);

CREATE TABLE ai_interview_questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES ai_interview_sessions(id) ON DELETE CASCADE,
    question_number SMALLINT NOT NULL CHECK (question_number > 0),
    categorie       VARCHAR(30) NOT NULL,
    question        TEXT NOT NULL,
    UNIQUE (session_id, question_number)
);

CREATE TABLE ai_interview_answers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES ai_interview_sessions(id) ON DELETE CASCADE,
    question_number SMALLINT NOT NULL CHECK (question_number > 0),
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_seconds NUMERIC(8,1),
    UNIQUE (session_id, question_number)
);

-- 20. ENTRETIEN IA VOCAL (moteur Python)
CREATE TABLE ai_interviews (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id     UUID NOT NULL REFERENCES candidature(id) ON DELETE CASCADE,
    python_session_id  VARCHAR(64),
    statut             VARCHAR(20) NOT NULL DEFAULT 'CREATED'
                       CHECK (statut IN ('CREATED', 'STARTED', 'COMPLETED', 'FAILED')),
    questions          JSONB,
    report             JSONB,
    error_message      VARCHAR(500),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at         TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 21. ENTRETIENS HUMAINS
CREATE TABLE human_interviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidature_id  UUID NOT NULL UNIQUE REFERENCES candidature(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    heure           TIME NOT NULL,
    interviewer     VARCHAR(200) NOT NULL,
    lien_visio      VARCHAR(500),
    statut          VARCHAR(40) NOT NULL DEFAULT 'PLANIFIE'
                    CHECK (statut IN ('PLANIFIE', 'TERMINE', 'ANNULE', 'HUMAN_INTERVIEW_COMPLETED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    duree           INTEGER,
    interviewer_email VARCHAR(255),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    human_interview_reminder_sent BOOLEAN NOT NULL DEFAULT false,
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES utilisateur(id) ON DELETE SET NULL
);

-- 22. INDEX
CREATE INDEX idx_device_token_utilisateur     ON device_token(utilisateur_id);
CREATE INDEX idx_utilisateur_role            ON utilisateur(role);
CREATE INDEX idx_encadrant_departement        ON encadrant(departement_id);
CREATE INDEX idx_offre_stage_departement      ON offre_stage(departement_id);
CREATE INDEX idx_offre_stage_statut           ON offre_stage(statut);
CREATE INDEX idx_offre_stage_encadrant        ON offre_stage(encadrant_id);
CREATE INDEX idx_candidature_stagiaire        ON candidature(stagiaire_id);
CREATE INDEX idx_candidature_candidat         ON candidature(candidat_id);
CREATE INDEX idx_candidature_offre            ON candidature(offre_id);
CREATE INDEX idx_candidature_statut           ON candidature(statut);
CREATE INDEX idx_candidature_mobile_email     ON candidature(internship_start_date, mobile_access_email_state)
  WHERE deleted_at IS NULL AND internship_period_validated_at IS NOT NULL AND mobile_access_email_sent_at IS NULL;
CREATE INDEX idx_stage_stagiaire              ON stage(stagiaire_id);
CREATE INDEX idx_stage_encadrant              ON stage(encadrant_id);
CREATE INDEX idx_stage_departement            ON stage(departement_id);
CREATE INDEX idx_stage_offre                  ON stage(offre_id);
CREATE INDEX idx_stage_statut                 ON stage(statut);
CREATE INDEX idx_tache_projet                 ON tache(projet_id);
CREATE INDEX idx_tache_createur               ON tache(createur_id);
CREATE INDEX idx_tache_executant              ON tache(executant_id);
CREATE INDEX idx_tache_statut                 ON tache(statut);
CREATE INDEX idx_document_stagiaire           ON document(stagiaire_id);
CREATE INDEX idx_document_stage               ON document(stage_id);
CREATE INDEX idx_rapport_stage                ON rapport(stage_id);
CREATE INDEX idx_evaluation_stage             ON evaluation(stage_id);
CREATE INDEX idx_evaluation_encadrant         ON evaluation(encadrant_id);
CREATE INDEX idx_reunion_stage                ON reunion(stage_id);
CREATE INDEX idx_journal_stage                ON journal(stage_id);
CREATE INDEX idx_journal_semaine              ON journal(semaine);
CREATE INDEX idx_notification_utilisateur     ON notification(utilisateur_id, lue);
CREATE INDEX idx_utilisateur_permission_permission ON utilisateur_permission(permission_id);
CREATE INDEX idx_cv_analyse_candidat          ON cv_analyse(candidat_id);
CREATE INDEX idx_ai_session_candidature       ON ai_interview_sessions(candidature_id);
CREATE INDEX idx_ai_session_token             ON ai_interview_sessions(token);
CREATE INDEX idx_ai_questions_session         ON ai_interview_questions(session_id);
CREATE INDEX idx_ai_answers_session           ON ai_interview_answers(session_id);
CREATE INDEX idx_ai_interviews_candidature    ON ai_interviews(candidature_id);
CREATE INDEX idx_human_interview_candidature  ON human_interviews(candidature_id);

-- 23. TRIGGERS
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_utilisateur
    BEFORE UPDATE ON utilisateur
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_reunion
    BEFORE UPDATE ON reunion
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_evaluation
    BEFORE UPDATE ON evaluation
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- 24. TACHES PERSONNELLES DU STAGIAIRE
CREATE TABLE tache_personnelle (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stagiaire_id    UUID NOT NULL REFERENCES stagiaire(id) ON DELETE CASCADE,
    titre           VARCHAR(200) NOT NULL,
    description     TEXT,
    statut          statut_tache NOT NULL DEFAULT 'A_FAIRE',
    priorite        priorite_tache,
    date_echeance   DATE,
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tp_stagiaire_statut_pos ON tache_personnelle(stagiaire_id, statut, position);
CREATE INDEX idx_tp_stagiaire           ON tache_personnelle(stagiaire_id);

CREATE TRIGGER set_updated_at_tache_personnelle
    BEFORE UPDATE ON tache_personnelle
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- 25. TEMPLATES DE DOCUMENTS
-- Gabarits de documents (convention, attestation, evaluation, ...) éditables.
-- `type` réutilise l'enum type_document ; `variables` = placeholders déclarés ;
-- `version` est monotone par type (historique, jamais d'édition rétroactive).
CREATE TABLE document_template (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom             VARCHAR(120)        NOT NULL,
    type            type_document       NOT NULL,
    contenu         TEXT                NOT NULL,
    variables       JSONB               NOT NULL DEFAULT '[]'::jsonb,
    actif           BOOLEAN             NOT NULL DEFAULT true,
    version         INTEGER             NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_by      UUID REFERENCES utilisateur(id),
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT now(),
    UNIQUE (type, version)
);

CREATE INDEX idx_document_template_type_actif ON document_template(type, actif);

CREATE TRIGGER set_updated_at_document_template
    BEFORE UPDATE ON document_template
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- Documents générés à partir d'un template : version utilisée, variables
-- injectées et fichier produit. template_id → SET NULL (historique conservé
-- même si le gabarit est supprimé) ; stage_id → CASCADE (comme `document`).
CREATE TABLE document_generated (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     UUID REFERENCES document_template(id) ON DELETE SET NULL,
    template_version INTEGER             NOT NULL,
    stage_id        UUID REFERENCES stage(id) ON DELETE CASCADE,
    variables       JSONB               NOT NULL DEFAULT '{}'::jsonb,
    chemin          VARCHAR(500)        NOT NULL,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_generated_template ON document_generated(template_id);
CREATE INDEX idx_document_generated_stage ON document_generated(stage_id);

-- =====================================================================
-- Section 26 — P2-TASK2 : sous-tâches hiérarchiques
-- =====================================================================
-- Table dédiée (et non colonne sur `tache`) car les statuts métier
-- exacts TODO / IN_PROGRESS / DONE sont incompatibles avec l'enum
-- `statut_tache` existant : aucun enregistrement existant n'est affecté.
-- `tache_id` → CASCADE : supprimer la tâche parente supprime ses
-- sous-tâches. Un seul niveau de hiérarchie (pas de sous-sous-tâches).
CREATE TABLE subtask (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tache_id    UUID NOT NULL REFERENCES tache(id) ON DELETE CASCADE,
    titre       VARCHAR(200) NOT NULL,
    description TEXT,
    statut      TEXT NOT NULL DEFAULT 'TODO'
                CHECK (statut IN ('TODO', 'IN_PROGRESS', 'DONE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtask_tache ON subtask(tache_id);

CREATE TRIGGER set_updated_at_subtask
    BEFORE UPDATE ON subtask
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- =====================================================================
-- Section 27 — P2-TASK5 : notes personnelles des stagiaires
-- =====================================================================
-- Carnet privé (brainstorming) : ni journaux, ni rapports, ni documents
-- de certification. Propriétaire = stagiaire dérivé de la session.
-- `client_key` + index unique partiel : idempotence de création.
CREATE TABLE note (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stagiaire_id UUID NOT NULL REFERENCES stagiaire(id) ON DELETE CASCADE,
    titre        VARCHAR(200) NOT NULL DEFAULT '',
    contenu      TEXT NOT NULL DEFAULT '',
    pinned       BOOLEAN NOT NULL DEFAULT false,
    client_key   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_note_owner_client_key
    ON note(stagiaire_id, client_key) WHERE client_key IS NOT NULL;
CREATE INDEX idx_note_owner_updated ON note(stagiaire_id, updated_at DESC);

CREATE TRIGGER set_updated_at_note
    BEFORE UPDATE ON note
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

-- =====================================================================
-- Section 28 — P2-TASK6 : certification de fin de stage
-- =====================================================================
-- Dossier par stage (UNIQUE stage_id) : journal + rapport PDF versionnés
-- (jamais d'écrasement), machine à états, décisions historisées.
CREATE TABLE certification (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id       UUID NOT NULL UNIQUE REFERENCES stage(id) ON DELETE CASCADE,
    stagiaire_id   UUID NOT NULL REFERENCES stagiaire(id) ON DELETE CASCADE,
    statut         TEXT NOT NULL DEFAULT 'NOT_SUBMITTED'
                   CHECK (statut IN ('NOT_SUBMITTED', 'SUBMITTED', 'REDO_REQUESTED', 'DENIED', 'VALIDATED', 'CERTIFICATE_GENERATED')),
    reviewer_id    UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
    reason         TEXT,
    document_concerne TEXT CHECK (document_concerne IS NULL OR document_concerne IN ('JOURNAL', 'RAPPORT')),
    submitted_at   TIMESTAMPTZ,
    decided_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certification_stage ON certification(stage_id);

CREATE TRIGGER set_updated_at_certification
    BEFORE UPDATE ON certification
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE certification_document (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certification_id UUID NOT NULL REFERENCES certification(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL CHECK (kind IN ('JOURNAL', 'RAPPORT')),
    version          INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    nom              VARCHAR(255) NOT NULL,
    chemin           VARCHAR(500) NOT NULL,
    taille           INTEGER NOT NULL DEFAULT 0 CHECK (taille >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certification_document_cert
    ON certification_document(certification_id, kind, version);

CREATE TABLE certification_decision (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certification_id UUID NOT NULL REFERENCES certification(id) ON DELETE CASCADE,
    from_statut      TEXT NOT NULL,
    to_statut        TEXT NOT NULL,
    reviewer_id      UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
    reason           TEXT,
    document_concerne TEXT CHECK (document_concerne IS NULL OR document_concerne IN ('JOURNAL', 'RAPPORT')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certification_decision_cert
    ON certification_decision(certification_id, created_at);

-- P2-TASK8 : chemin du PDF d'attestation généré après validation
-- (génération idempotente, un seul fichier par dossier).
ALTER TABLE certification ADD COLUMN attestation_chemin VARCHAR(500);
