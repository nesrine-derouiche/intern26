require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || ''
});

const migrations = [
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `ALTER TABLE candidature DROP CONSTRAINT IF EXISTS candidature_stagiaire_id_offre_id_key`,
  `DROP INDEX IF EXISTS idx_candidature_unique_active`,
  `CREATE UNIQUE INDEX idx_candidature_unique_active ON candidature(stagiaire_id, offre_id) WHERE deleted_at IS NULL`,
  `DO $$ BEGIN CREATE TYPE statut_journal AS ENUM ('BROUILLON', 'SOUMIS', 'VALIDE', 'REJETE'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `CREATE TABLE IF NOT EXISTS journal (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_journal_stage ON journal(stage_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_semaine ON journal(semaine)`,
  `CREATE TABLE IF NOT EXISTS device_token (
     id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
     token         VARCHAR(500) NOT NULL UNIQUE,
     platform      VARCHAR(20) NOT NULL DEFAULT 'android',
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_device_token_utilisateur ON device_token(utilisateur_id)`,

  // ── Candidats (portail public) ─────────────────────────────
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'role_utilisateur' AND e.enumlabel = 'CANDIDAT') THEN
       ALTER TYPE role_utilisateur ADD VALUE 'CANDIDAT';
     END IF;
   END $$`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS adresse VARCHAR(255)`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verifie BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`,
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS candidat (
     id            UUID PRIMARY KEY REFERENCES utilisateur(id) ON DELETE CASCADE,
     universite    VARCHAR(255),
     specialite    VARCHAR(150),
     niveau        VARCHAR(50),
     competences   TEXT,
     langues       VARCHAR(255),
     github        VARCHAR(255),
     linkedin      VARCHAR(255),
     portfolio     VARCHAR(255),
     photo_path    VARCHAR(500),
     cv_path       VARCHAR(500),
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // ── Offres : champs détail du portail public ───────────────
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS missions TEXT`,
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS technologies VARCHAR(500)`,
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS documents_demandes TEXT`,
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS localisation VARCHAR(150)`,
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS niveau VARCHAR(50)`,
  `ALTER TABLE offre_stage ADD COLUMN IF NOT EXISTS encadrant_id UUID REFERENCES encadrant(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_offre_stage_encadrant ON offre_stage(encadrant_id)`,

  // ── Candidatures : candidats (sans création de stagiaire) ─
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS candidat_id UUID REFERENCES candidat(id) ON DELETE CASCADE`,
  `ALTER TABLE candidature ALTER COLUMN stagiaire_id DROP NOT NULL`,
  `DROP INDEX IF EXISTS idx_candidature_unique_active`,
  `CREATE UNIQUE INDEX idx_candidature_unique_active ON candidature(stagiaire_id, offre_id) WHERE deleted_at IS NULL AND candidat_id IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_candidature_unique_candidat ON candidature(candidat_id, offre_id) WHERE deleted_at IS NULL AND candidat_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_candidature_candidat ON candidature(candidat_id)`,

  // ── CV candidat : métadonnées + architecture d'analyse ─────
  `ALTER TABLE candidat ADD COLUMN IF NOT EXISTS cv_original_name VARCHAR(255)`,
  `ALTER TABLE candidat ADD COLUMN IF NOT EXISTS cv_size BIGINT`,
  `ALTER TABLE candidat ADD COLUMN IF NOT EXISTS cv_uploaded_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS cv_analyse (
     id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     candidat_id   UUID NOT NULL REFERENCES candidat(id) ON DELETE CASCADE,
     cv_filename   VARCHAR(500),
     statut        VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE',
     resultat      JSONB,
     ai_provider   VARCHAR(50),
     erreur        TEXT,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_cv_analyse_candidat ON cv_analyse(candidat_id)`,

  // ── Workflow recrutement RH : présélection pour entretien IA ──
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'EN_ENTRETIEN_IA') THEN
       ALTER TYPE statut_candidature ADD VALUE 'EN_ENTRETIEN_IA';
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'RH_ACCEPTED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'RH_ACCEPTED';
     END IF;
   END $$`,
  // ── Workflow entretien IA : résultats (déclenchés par le futur moteur IA) ──
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'AI_INTERVIEW_PASSED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'AI_INTERVIEW_PASSED';
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'AI_INTERVIEW_FAILED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'AI_INTERVIEW_FAILED';
     END IF;
   END $$`,
  `ALTER TABLE notification ADD COLUMN IF NOT EXISTS lien VARCHAR(500)`,

  // ── Entretien IA : session, questions, réponses ────────────
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'EN_ENTRETIEN_HUMAIN') THEN
       ALTER TYPE statut_candidature ADD VALUE 'EN_ENTRETIEN_HUMAIN';
     END IF;
   END $$`,
  `DO $$ BEGIN
     CREATE TYPE statut_entretien_ia AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE');
   EXCEPTION WHEN duplicate_object THEN null;
   END $$`,
  `CREATE TABLE IF NOT EXISTS ai_interview_sessions (
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
     updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_session_candidature ON ai_interview_sessions(candidature_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_session_token ON ai_interview_sessions(token)`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS python_session_id VARCHAR(64)`,
  `CREATE TABLE IF NOT EXISTS ai_interview_questions (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     session_id      UUID NOT NULL REFERENCES ai_interview_sessions(id) ON DELETE CASCADE,
     question_number SMALLINT NOT NULL CHECK (question_number > 0),
     categorie       VARCHAR(30) NOT NULL,
     question        TEXT NOT NULL,
     UNIQUE (session_id, question_number)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_questions_session ON ai_interview_questions(session_id)`,
  `CREATE TABLE IF NOT EXISTS ai_interview_answers (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     session_id      UUID NOT NULL REFERENCES ai_interview_sessions(id) ON DELETE CASCADE,
     question_number SMALLINT NOT NULL CHECK (question_number > 0),
     question        TEXT NOT NULL,
     answer          TEXT NOT NULL,
     created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (session_id, question_number)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_answers_session ON ai_interview_answers(session_id)`,

  // ── Entretien humain (planification RH après réussite de l'entretien IA) ──
  `CREATE TABLE IF NOT EXISTS human_interviews (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     candidature_id  UUID NOT NULL UNIQUE REFERENCES candidature(id) ON DELETE CASCADE,
     date            DATE NOT NULL,
     heure           TIME NOT NULL,
     interviewer     VARCHAR(200) NOT NULL,
     lien_visio      VARCHAR(500),
     statut          VARCHAR(20) NOT NULL DEFAULT 'PLANIFIE'
                     CHECK (statut IN ('PLANIFIE', 'TERMINE')),
     created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_human_interview_candidature ON human_interviews(candidature_id)`,
  // ── Entretien humain : planification RH enrichie ──────────────
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS duree INTEGER`,
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS interviewer_email VARCHAR(255)`,
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE human_interviews DROP CONSTRAINT IF EXISTS human_interviews_statut_check`,
  `ALTER TABLE human_interviews ALTER COLUMN statut TYPE VARCHAR(40)`,
  `ALTER TABLE human_interviews ADD CONSTRAINT human_interviews_statut_check CHECK (statut IN ('PLANIFIE', 'TERMINE', 'ANNULE', 'HUMAN_INTERVIEW_COMPLETED'))`,

  // ── Entretien IA vocal : sessions pilotées par le moteur Python (ai-service) ──
  `CREATE TABLE IF NOT EXISTS ai_interviews (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_interviews_candidature ON ai_interviews(candidature_id)`,

  // ── Intégrité de l'entretien IA (événements techniques, sans analyse biométrique) ──
  // Uniquement des faits techniques : changement d'onglet/fenêtre, plein écran,
  // caméra/micro désactivés ou perdus, interruption réseau. AUCUNE donnée
  // biométrique (pas de reconnaissance faciale, pas de mesure physiologique).
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_events JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_devices JSONB`,

  // ── Anti-triche : empreinte d'appareil + moteur de risque ──────────────
  // Le moteur de risque (utils/anti-cheat.util.js) agrège les faits techniques
  // en un score pondéré (0-100) et un niveau (LOW/MODERATE/HIGH/CRITICAL) qui
  // aide le RH à rejouer la décision. Il ne produit JAMAIS de verdict seul.
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(512)`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS device_checks SMALLINT NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS device_fingerprint_changed BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_risk_score SMALLINT NOT NULL DEFAULT 0`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW'
     CHECK (integrity_risk_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL'))`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_flags JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE ai_interview_sessions ADD COLUMN IF NOT EXISTS integrity_computed_at TIMESTAMPTZ`,
  // Durée (secondes) d'enregistrement d'une réponse — signal anti-réponses scriptées.
  `ALTER TABLE ai_interview_answers ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(8,1)`,

  // ── Rappel automatique de l'entretien humain (jour J) ───────────
  // Passe à true une fois le rappel « votre entretien est aujourd'hui »
  // envoyé : garantit qu'aucun rappel en double ne soit jamais émis.
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS human_interview_reminder_sent BOOLEAN NOT NULL DEFAULT false`,

  // ── Achèvement de l'entretien humain (le RH marque l'entretien réalisé) ──
  // Le statut HUMAN_INTERVIEW_COMPLETED indique que l'entretien a eu lieu.
  // completed_at / completed_by tracent qui l'a marqué comme terminé.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'HUMAN_INTERVIEW_COMPLETED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'HUMAN_INTERVIEW_COMPLETED';
     END IF;
   END $$`,
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,
  `ALTER TABLE human_interviews ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES utilisateur(id) ON DELETE SET NULL`,

  // ── Décision finale RH après l'entretien humain complété ──────
  // La décision (ACCEPTED/REJECTED) est tracée sur la candidature
  // (decision/decided_by/decided_at) ET dans candidature_decisions pour
  // l'historique d'audit (décision, RH, horodatage, statut précédent/nouveau).
  // Le stagiaire n'est PAS créé automatiquement à cette étape.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'HUMAN_INTERVIEW_ACCEPTED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'HUMAN_INTERVIEW_ACCEPTED';
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'HUMAN_INTERVIEW_REJECTED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'HUMAN_INTERVIEW_REJECTED';
     END IF;
   END $$`,

  // ── Conversion dossier prêt → stagiaire (READY_FOR_TRAINEE → STAGIAIRE_CREATED) ──
  // Aucun statut existant de statut_candidature ne représente « le candidat est
  // devenu stagiaire » (ACCEPTEE est une acceptation générique sans création de
  // stage ; HUMAN_INTERVIEW_ACCEPTED précède l'onboarding). STAGIAIRE_CREATED
  // marque la conversion effective : stagiaire + stage créés dans une
  // transaction, dossier définitivement clos.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'statut_candidature' AND e.enumlabel = 'STAGIAIRE_CREATED') THEN
       ALTER TYPE statut_candidature ADD VALUE 'STAGIAIRE_CREATED';
     END IF;
   END $$`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS decision VARCHAR(30)`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES utilisateur(id) ON DELETE SET NULL`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS candidature_decisions (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     candidature_id  UUID NOT NULL REFERENCES candidature(id) ON DELETE CASCADE,
     decision        VARCHAR(30) NOT NULL,
     decided_by      UUID NOT NULL REFERENCES utilisateur(id) ON DELETE SET NULL,
     decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     previous_status VARCHAR(50) NOT NULL,
     new_status      VARCHAR(50) NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_candidature_decisions_candidature ON candidature_decisions(candidature_id)`,

  // ── Préférences de stage du candidat (après acceptation post-entretien humain) ──
  // Le candidat accepté choisit lui-même la date de début souhaitée et la durée
  // (en mois). `internship_details_submitted_at` trace l'horodatage de la
  // soumission. Aucun stage n'est créé à cette étape : la validation RH
  // viendra dans une étape ultérieure.
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_start_date DATE`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_duration_months INTEGER`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_details_submitted_at TIMESTAMPTZ`,

  // ── Validation RH de la période de stage du candidat accepté ──
  // `internship_period_validated_at` / `internship_period_validated_by` verrouillent
  // la période choisie par le candidat : une fois validée, le candidat ne peut
  // plus la modifier (le backend le refuse). `internship_modification_requested_at`
  // trace la demande RH de modification : la période redevient éditable et le
  // candidat peut resoumettre. Aucun stagiaire n'est créé à cette étape.
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_period_validated_at TIMESTAMPTZ`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_period_validated_by UUID REFERENCES utilisateur(id) ON DELETE SET NULL`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS internship_modification_requested_at TIMESTAMPTZ`,
  // L'historique d'audit existant (candidature_decisions) accueille aussi les
  // actions de validation / demande de modification : colonne `action` pour
  // distinguer les types d'entrées, et les champs de la période validée.
  `ALTER TABLE candidature_decisions ADD COLUMN IF NOT EXISTS action VARCHAR(50)`,
  `ALTER TABLE candidature_decisions ADD COLUMN IF NOT EXISTS internship_start_date DATE`,
  `ALTER TABLE candidature_decisions ADD COLUMN IF NOT EXISTS internship_duration_months INTEGER`,

  // ── Préparation de l'accès à l'application mobile (candidat accepté) ──
  // Après validation RH de la période, `mobile_access_prepared_at` marque le
  // début de la préparation du compte mobile. Le mot de passe temporaire n'est
  // jamais stocké en clair : seule sa version chiffrée (AES-256-GCM) est
  // conservée dans `mobile_access_credentials_encrypted`, uniquement tant que
  // l'email D-1 n'a pas été envoyé (la colonne est purgée au succès).
  // `mobile_access_email_state` suit l'envoi automatique de l'email d'accès
  // (PENDING → SENT, ou ERROR sur échec transitoire avec nouvelle tentative).
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS mobile_access_prepared_at TIMESTAMPTZ`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS mobile_access_email_state VARCHAR(20) NOT NULL DEFAULT 'PENDING'`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS mobile_access_email_sent_at TIMESTAMPTZ`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS mobile_access_email_error VARCHAR(500)`,
  `ALTER TABLE candidature ADD COLUMN IF NOT EXISTS mobile_access_credentials_encrypted TEXT`,
  // Index pour la requête du job D-1 : candidatures validées, non encore servies.
  `CREATE INDEX IF NOT EXISTS idx_candidature_mobile_email ON candidature(internship_start_date, mobile_access_email_state)
     WHERE deleted_at IS NULL AND internship_period_validated_at IS NOT NULL AND mobile_access_email_sent_at IS NULL`,

  // ── Phase 5 : dossier de candidature (onboarding documents) ──────────
  // Documents requis d'un candidat accepté (CV, CIN, demande de stage,
  // lettre d'affectation) AVANT la création du stagiaire/du stage : ils sont
  // rattachés à la candidature. Statuts : MANQUANT / EN_ATTENTE / VALIDE /
  // REJETE. La vérification (OCR / IA / authentification) sera une étape
  // ultérieure : ce dépôt est uniquement la soumission par le candidat.
  `CREATE TABLE IF NOT EXISTS candidature_document (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     candidature_id  UUID NOT NULL REFERENCES candidature(id) ON DELETE CASCADE,
     type            VARCHAR(30) NOT NULL
                     CHECK (type IN ('CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION')),
     nom             VARCHAR(255) NOT NULL,
     chemin          VARCHAR(500) NOT NULL,
     date_depot      TIMESTAMPTZ NOT NULL DEFAULT now(),
     statut          VARCHAR(20) NOT NULL DEFAULT 'EN_ATTENTE'
                     CHECK (statut IN ('MANQUANT', 'EN_ATTENTE', 'VALIDE', 'REJETE')),
     rejected_reason VARCHAR(500)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_candidature_document_unique
     ON candidature_document(candidature_id, type)`,
  `CREATE INDEX IF NOT EXISTS idx_candidature_document_candidature
     ON candidature_document(candidature_id)`,

  // ── Phase 6 : verdict de vérification des documents du dossier ──────
  // Verdict produit par le service d'analyse documentaire (Python) :
  // PENDING (vérification en cours) / VALID / REVIEW_REQUIRED / REJECTED.
  // Indépendant de `statut` (workflow RH) : NULL tant que la vérification
  // automatique n'a pas débuté. C'est la source du garde d'accès au stage.
  `ALTER TABLE candidature_document ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20)
     CHECK (verification_status IN ('PENDING', 'VALID', 'REVIEW_REQUIRED', 'REJECTED'))`,

  // ── Phase 7 : décision RH de vérification manuelle d'un document ──────
  // Rattache les décisions de vérification manuelle (VALID/REJECTED, action
  // DOCUMENT_REVIEW) au document concerné dans l'historique d'audit existant.
  // Nullable : les décisions de candidature / période de stage n'y sont pas liées.
  `ALTER TABLE candidature_decisions ADD COLUMN IF NOT EXISTS document_id UUID
     REFERENCES candidature_document(id) ON DELETE SET NULL`,

  // ── Invalidation de session après conversion candidat → stagiaire ──────
  // `token_version` est incluse dans le JWT. À chaque changement de rôle
  // (conversion), la version est incrémentée : l'ancien token est rejeté
  // par le middleware d'authentification (401) et l'utilisateur doit se
  // reconnecter pour obtenir un token avec le nouveau rôle.
  `ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`,

  // ── M5 : horodatage de cycle de vie réunion & évaluation ──────────────
  // Les colonnes `created_at` / `updated_at` étaient absentes de ces deux
  // tables. On réutilise la fonction partagée `trg_set_updated_at()`
  // (déjà en place sur `utilisateur`) : aucun second mécanisme n'est inventé.
  // `ADD COLUMN IF NOT EXISTS` rend la migration idempotente ; le couple
  // DROP/CREATE TRIGGER aussi.
  `CREATE OR REPLACE FUNCTION trg_set_updated_at()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = now();
       RETURN NEW;
     END;
   $$ LANGUAGE plpgsql`,
  `ALTER TABLE reunion ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE reunion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `DROP TRIGGER IF EXISTS set_updated_at_reunion ON reunion`,
  `CREATE TRIGGER set_updated_at_reunion BEFORE UPDATE ON reunion FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,
  `ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE evaluation ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `DROP TRIGGER IF EXISTS set_updated_at_evaluation ON evaluation`,
  `CREATE TRIGGER set_updated_at_evaluation BEFORE UPDATE ON evaluation FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,
  // ── Tâches personnelles du stagiaire ──
  `CREATE TABLE IF NOT EXISTS tache_personnelle (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tp_stagiaire_statut_pos ON tache_personnelle(stagiaire_id, statut, position)`,
  `CREATE INDEX IF NOT EXISTS idx_tp_stagiaire           ON tache_personnelle(stagiaire_id)`,
  `DROP TRIGGER IF EXISTS set_updated_at_tache_personnelle ON tache_personnelle`,
  `CREATE TRIGGER set_updated_at_tache_personnelle BEFORE UPDATE ON tache_personnelle FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,

  // ── Présences / Pointage ───────────────────────────────────────────
  `DO $$ BEGIN
     CREATE TYPE statut_presence AS ENUM ('PRESENT', 'RETARD', 'ABSENT');
   EXCEPTION WHEN duplicate_object THEN null;
   END $$`,
  `CREATE TABLE IF NOT EXISTS pointage (
     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     stage_id        UUID NOT NULL REFERENCES stage(id) ON DELETE CASCADE,
     date_pointage   DATE NOT NULL,
     heure_entree    TIMESTAMPTZ,
     heure_sortie    TIMESTAMPTZ,
     duree_minutes   INTEGER GENERATED ALWAYS AS (
       CASE WHEN heure_entree IS NOT NULL AND heure_sortie IS NOT NULL
       THEN EXTRACT(EPOCH FROM (heure_sortie - heure_entree)) / 60
       ELSE NULL END
     ) STORED,
     retard_minutes  INTEGER NOT NULL DEFAULT 0,
     statut          statut_presence NOT NULL DEFAULT 'PRESENT',
     commentaire     TEXT,
     created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (stage_id, date_pointage)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_pointage_stage ON pointage(stage_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pointage_date ON pointage(date_pointage)`,
  `CREATE INDEX IF NOT EXISTS idx_pointage_statut ON pointage(statut)`,
  `DROP TRIGGER IF EXISTS set_updated_at_pointage ON pointage`,
  `CREATE TRIGGER set_updated_at_pointage BEFORE UPDATE ON pointage FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,
  `CREATE TABLE IF NOT EXISTS horaire (
     id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     stage_id              UUID NOT NULL REFERENCES stage(id) ON DELETE CASCADE,
     heure_debut           TIME NOT NULL DEFAULT '09:00',
     heure_fin             TIME NOT NULL DEFAULT '17:00',
     duree_pause_minutes   INTEGER NOT NULL DEFAULT 60,
     created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (stage_id)
   )`,
  `DROP TRIGGER IF EXISTS set_updated_at_horaire ON horaire`,
  `CREATE TRIGGER set_updated_at_horaire BEFORE UPDATE ON horaire FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,

  // ── P1-3A : Templates de documents ────────────────────────────────────
  // Gabarits de documents (convention, attestation, evaluation, ...) éditables
  // par l'ADMIN/RH. `type` réutilise l'enum existant `type_document` ;
  // `variables` est la liste déclarée des placeholders du gabarit ;
  // `version` est monotone par type et sert d'historique (jamais d'édition
  // d'une version existante). `updated_at` est piloté par la fonction
  // partagée `trg_set_updated_at()` déjà créée plus haut (aucun second
  // mécanisme de trigger n'est inventé).
  `CREATE TABLE IF NOT EXISTS document_template (
     id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     nom          VARCHAR(120) NOT NULL,
     type         type_document NOT NULL,
     contenu      TEXT NOT NULL,
     variables    JSONB NOT NULL DEFAULT '[]'::jsonb,
     actif        BOOLEAN NOT NULL DEFAULT true,
     version      INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
     created_by   UUID REFERENCES utilisateur(id),
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (type, version)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_document_template_type_actif ON document_template(type, actif)`,
  `DROP TRIGGER IF EXISTS set_updated_at_document_template ON document_template`,
  `CREATE TRIGGER set_updated_at_document_template BEFORE UPDATE ON document_template FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,

  // Documents générés à partir d'un template : trace de la version utilisée,
  // des variables injectées et du fichier produit. `template_id` passe en
  // SET NULL à la suppression du gabarit pour ne jamais perdre l'historique ;
  // `stage_id` suit la suppression du stage comme sur `document`.
  `CREATE TABLE IF NOT EXISTS document_generated (
     id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     template_id      UUID REFERENCES document_template(id) ON DELETE SET NULL,
     template_version INTEGER NOT NULL,
     stage_id         UUID REFERENCES stage(id) ON DELETE CASCADE,
     variables        JSONB NOT NULL DEFAULT '{}'::jsonb,
     chemin           VARCHAR(500) NOT NULL,
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_document_generated_template ON document_generated(template_id)`,
  `CREATE INDEX IF NOT EXISTS idx_document_generated_stage ON document_generated(stage_id)`,

  // ── P2-TASK2 : Sous-tâches hiérarchiques ──────────────────────────────
  // Les sous-tâches vivent dans leur propre table car leurs statuts
  // métier exacts (TODO / IN_PROGRESS / DONE) sont incompatibles avec
  // l'enum existant `statut_tache` (A_FAIRE / EN_COURS / TERMINEE /
  // BLOQUEE) : aucune modification du schéma `tache` existant, aucun
  // enregistrement existant n'est affecté. `tache_id` → CASCADE (la
  // suppression de la tâche parente supprime ses sous-tâches).
  // `updated_at` est piloté par la fonction partagée `trg_set_updated_at()`.
  `CREATE TABLE IF NOT EXISTS subtask (
     id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     tache_id    UUID NOT NULL REFERENCES tache(id) ON DELETE CASCADE,
     titre       VARCHAR(200) NOT NULL,
     description TEXT,
     statut      TEXT NOT NULL DEFAULT 'TODO'
                 CHECK (statut IN ('TODO', 'IN_PROGRESS', 'DONE')),
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_subtask_tache ON subtask(tache_id)`,
  `DROP TRIGGER IF EXISTS set_updated_at_subtask ON subtask`,
  `CREATE TRIGGER set_updated_at_subtask BEFORE UPDATE ON subtask FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,

  // ── P2-TASK5 : Notes personnelles des stagiaires ─────────────────────
  // Carnet privé de type brainstorming (ni journaux, ni rapports, ni
  // documents de certification). `stagiaire_id` = propriétaire exclusif
  // dérivé de la session (jamais d'un champ client) ; lecture/écriture
  // réservées au STAGIAIRE propriétaire (vérifié en service).
  // `client_key` + index unique partiel = idempotence de création lors
  // des reprises réseau (même clé → la note existante est renvoyée).
  // `pinned` permet l'épinglage (tri : épinglées d'abord, puis
  // updated_at DESC). `updated_at` piloté par `trg_set_updated_at()`.
  `CREATE TABLE IF NOT EXISTS note (
     id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     stagiaire_id UUID NOT NULL REFERENCES stagiaire(id) ON DELETE CASCADE,
     titre        VARCHAR(200) NOT NULL DEFAULT '',
     contenu      TEXT NOT NULL DEFAULT '',
     pinned       BOOLEAN NOT NULL DEFAULT false,
     client_key   TEXT,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_note_owner_client_key ON note(stagiaire_id, client_key) WHERE client_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_note_owner_updated ON note(stagiaire_id, updated_at DESC)`,
  `DROP TRIGGER IF EXISTS set_updated_at_note ON note`,
  `CREATE TRIGGER set_updated_at_note BEFORE UPDATE ON note FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,

  // ── P2-TASK6 : Certification de fin de stage ─────────────────────────
  // Dossier de certification par stage (journal + rapport PDF) avec
  // machine à états (NOT_SUBMITTED → SUBMITTED → REDO_REQUESTED /
  // DENIED / VALIDATED → CERTIFICATE_GENERATED). Une seule certification
  // par stage (UNIQUE stage_id). Les documents sont versionnés : chaque
  // dépôt insère une nouvelle ligne (jamais d'écrasement) ; la version
  // courante d'un type est la plus récente. Les décisions (transitions)
  // sont historisées avec motif, document concerné et relecteur.
  // `updated_at` piloté par `trg_set_updated_at()`.
  `CREATE TABLE IF NOT EXISTS certification (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_certification_stage ON certification(stage_id)`,
  `DROP TRIGGER IF EXISTS set_updated_at_certification ON certification`,
  `CREATE TRIGGER set_updated_at_certification BEFORE UPDATE ON certification FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()`,
  `CREATE TABLE IF NOT EXISTS certification_document (
     id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     certification_id UUID NOT NULL REFERENCES certification(id) ON DELETE CASCADE,
     kind             TEXT NOT NULL CHECK (kind IN ('JOURNAL', 'RAPPORT')),
     version          INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
     nom              VARCHAR(255) NOT NULL,
     chemin           VARCHAR(500) NOT NULL,
     taille           INTEGER NOT NULL DEFAULT 0 CHECK (taille >= 0),
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_certification_document_cert ON certification_document(certification_id, kind, version)`,
  `CREATE TABLE IF NOT EXISTS certification_decision (
     id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     certification_id UUID NOT NULL REFERENCES certification(id) ON DELETE CASCADE,
     from_statut      TEXT NOT NULL,
     to_statut        TEXT NOT NULL,
     reviewer_id      UUID REFERENCES utilisateur(id) ON DELETE SET NULL,
     reason           TEXT,
     document_concerne TEXT CHECK (document_concerne IS NULL OR document_concerne IN ('JOURNAL', 'RAPPORT')),
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_certification_decision_cert ON certification_decision(certification_id, created_at)`,

  // ── P2-TASK8 : Attestation générée de certification ───────────────────
  // Chemin du PDF d'attestation produit après validation (génération
  // idempotente : un seul fichier par dossier). Ajout de colonne
  // nullable : aucun enregistrement existant n'est affecté.
  `ALTER TABLE certification ADD COLUMN IF NOT EXISTS attestation_chemin VARCHAR(500)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      console.log('Running:', sql.substring(0, 80) + '...');
      await client.query(sql);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
