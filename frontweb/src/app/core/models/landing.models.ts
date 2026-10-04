/** Modèles métier du portail public STEG Internship. */

export type OfferLevel = 'BTS' | 'Technicien' | 'Licence' | 'Master' | 'Ingénieur';

export interface OfferEncadrant {
  nom: string;
  prenom: string;
  service?: string;
}

export interface LandingOffer {
  id: string;
  titre: string;
  departement: string;
  /** Identifiant du département (filtre serveur). */
  departementId?: string;
  description: string;
  /** Durée lisible (ex : « 6 mois »). */
  duree: string;
  localisation: string;
  niveau: OfferLevel;
  places: number;
  /** Date limite au format YYYY-MM-DD. */
  dateLimite: string;
  competences: string[];
  missions?: string[];
  technologies?: string[];
  documents?: string[];
  encadrant?: OfferEncadrant | null;
}

export interface LandingStat {
  /** Valeur affichée, animée au scroll. */
  value: number;
  /** Suffixe (ex : '%', '+'). */
  suffix: string;
  label: string;
  /** Icône inline (chemin d'icône SVG). */
  icon: string;
}

export interface LandingDomain {
  id: string;
  titre: string;
  description: string;
  nbStages: number;
  /** Icône inline SVG. */
  icon: string;
  /** Couleur d'accent (classe ou variable CSS). */
  color: string;
}

export interface WhyPoint {
  icon: string;
  titre: string;
  description: string;
}

/* ---- Auth & candidat ---- */

export type UserRole = 'CANDIDAT' | 'STAGIAIRE' | 'ENCADRANT' | 'RH' | 'ADMIN';

export interface AuthUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  telephone?: string;
  adresse?: string;
  universite?: string;
  specialite?: string;
  niveau?: string;
  competences?: string[];
  langues?: string[];
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface CvAnalysis {
  statut: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINEE' | 'ECHEC';
  aiProvider: string | null;
}

export interface CvInfo {
  /** Nom généré côté serveur (identifiant du fichier). */
  filename: string;
  /** Nom original du fichier déposé par le candidat. */
  originalName: string;
  /** Taille en octets. */
  size: number | null;
  /** Date de dépôt (ISO). */
  uploadedAt: string | null;
  /** État de l'analyse IA (architecture préparée, moteur non intégré). */
  analysis: CvAnalysis | null;
}

export interface CandidatProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  adresse: string | null;
  emailVerifie: boolean;
  universite: string | null;
  specialite: string | null;
  niveau: string | null;
  competences: string[];
  langues: string[];
  github: string | null;
  linkedin: string | null;
  portfolio: string | null;
  photo: { filename: string } | null;
  cv: CvInfo | null;
  createdAt: string;
}

export interface Candidature {
  id: string;
  offre_id: string;
  candidat_id?: string | null;
  statut:
    | 'EN_ATTENTE'
    | 'EN_ENTRETIEN_IA'
    | 'EN_ENTRETIEN_HUMAIN'
    | 'RH_ACCEPTED'
    | 'AI_INTERVIEW_PASSED'
    | 'AI_INTERVIEW_FAILED'
    | 'HUMAN_INTERVIEW_COMPLETED'
    | 'HUMAN_INTERVIEW_ACCEPTED'
    | 'HUMAN_INTERVIEW_REJECTED'
    | 'ACCEPTEE'
    | 'REFUSEE';
  date_candidature: string;
  /** Date de début de stage souhaitée (YYYY-MM-DD), renseignée par le candidat accepté. */
  internship_start_date?: string | null;
  /** Durée de stage choisie (en mois), renseignée par le candidat accepté. */
  internship_duration_months?: number | null;
  /** Horodatage de la dernière soumission des préférences de stage. */
  internship_details_submitted_at?: string | null;
  /** Horodatage de la validation RH de la période de stage (fige la période). */
  internship_period_validated_at?: string | null;
  /** Id du RH ayant validé la période de stage. */
  internship_period_validated_by?: string | null;
  /** Horodatage de la demande RH de modification (la période redevient éditable). */
  internship_modification_requested_at?: string | null;
  /** État de l'accès à l'application mobile (voir MobileAccess). */
  mobile_access?: MobileAccess;
}

/**
 * État de l'accès à l'application mobile d'une candidature (compte existant
 * réutilisé, email d'accès envoyé automatiquement la veille du début du stage).
 * Ne contient JAMAIS le mot de passe : la préparation et l'envoi sont gérés par
 * le backend (job D-1).
 */
export interface MobileAccess {
  /** Horodatage du début de la préparation du compte (après validation RH). */
  prepared_at?: string | null;
  /** PENDING → en préparation / programmé ; SENT → envoyé ; ERROR → nouvel essai prévu. */
  email_state: 'PENDING' | 'SENT' | 'ERROR';
  /** Horodatage de l'envoi effectif de l'email d'accès (null tant que non envoyé). */
  email_sent_at?: string | null;
  /** Dernière erreur d'envoi (visible uniquement côté RH). */
  email_error?: string | null;
  /** Date d'envoi prévue de l'email (YYYY-MM-DD, la veille du début de stage). */
  email_planned_for?: string | null;
}

/**
 * Ligne de « Mes candidatures » (GET /candidatures/mes-candidatures).
 * Liste filtrée côté serveur sur le candidat connecté : aucune candidature
 * d'un autre candidat ne peut être renvoyée.
 */
export interface CandidatureListItem {
  id: string;
  offre_id: string;
  offre_titre: string;
  departement_nom: string;
  statut: Candidature['statut'];
  date_candidature: string;
  /** Préférences de stage éventuelles déjà enregistrées par le candidat. */
  internship_start_date?: string | null;
  internship_duration_months?: number | null;
  internship_details_submitted_at?: string | null;
  internship_period_validated_at?: string | null;
  internship_period_validated_by?: string | null;
  internship_modification_requested_at?: string | null;
  /** État de l'accès à l'application mobile (voir MobileAccess). */
  mobile_access?: MobileAccess;
}

/* ---- Entretien humain ---- */

export type HumanInterviewStatut = 'PLANIFIE' | 'ANNULE' | 'HUMAN_INTERVIEW_COMPLETED';

/**
 * Entretien humain planifié par le RH (GET /candidatures/:id/entretien-humain).
 * `date` (YYYY-MM-DD) et `heure` (HH:MM) sont exprimées en fuseau Africa/Tunis
 * par le backend : elles sont affichées telles quelles, sans conversion.
 */
export interface HumanInterview {
  id: string;
  candidature_id: string;
  /** Date au format YYYY-MM-DD (Africa/Tunis). */
  date: string;
  /** Heure de début au format HH:MM (Africa/Tunis). */
  heure: string;
  /** Durée en minutes. */
  duree: number | null;
  interviewer: string;
  interviewer_email: string | null;
  /** Lien de visioconférence ; absent/null = entretien en présentiel. */
  lien_visio: string | null;
  statut: HumanInterviewStatut;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  /** Lieu d'un entretien présentiel (champs réservés, fournis si présents). */
  location?: string | null;
  /** Notes RH éventuelles. */
  notes?: string | null;
}

export type AiInterviewStatut = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE';

/**
 * Contexte d'un entretien IA accédé par lien sécurisé (GET /entretien-ia/:token).
 * Aucun identifiant interne n'est exposé : le token remplace l'id de candidature.
 * Les questions et réponses ne sont renvoyées que si l'entretien est en cours.
 */
export interface AiInterviewSession {
  id: string;
  token: string;
  statut: AiInterviewStatut;
  evaluation_status: string | null;
  date_candidature: string;
  candidat: {
    prenom: string;
    nom: string;
  };
  offre: {
    id: string;
    titre: string;
    departement_nom: string;
    duree: number;
    competences: string[];
    technologies: string[];
  };
  candidature: {
    id: string;
    statut: string;
  };
  questions?: AiInterviewQuestion[];
  answers?: AiInterviewAnswer[];
}

/** Question d'un entretien IA (POST /entretien-ia/:token/commencer). */
export interface AiInterviewQuestion {
  id?: string;
  question_number: number;
  categorie: string;
  question: string;
}

/** Réponse enregistrée d'un candidat (reprise d'entretien). */
export interface AiInterviewAnswer {
  id: string;
  question_number: number;
  question: string;
  answer: string;
}

/**
 * Démarrage d'un entretien vocal (POST /entretien-ia/:token/commencer).
 * `audio` est la première question synthétisée (TTS), encodée en base64.
 */
export interface AiInterviewStarted {
  question: AiInterviewQuestion;
  total_questions: number;
  audio: string;
  audio_format: string;
}

/**
 * Analyse d'une réponse vocale (POST /entretien-ia/:token/audio).
 * `done = true` marque la fin de l'entretien : plus de question ni d'audio.
 */
export interface AiInterviewAnswerResult {
  answer_text: string;
  question_number: number;
  next_question: AiInterviewQuestion | null;
  done: boolean;
  audio: string | null;
  audio_format: string | null;
}

/** Synthèse vocale d'un texte (POST /entretien-ia/:token/synthesize). */
export interface AiInterviewSynth {
  audio: string;
  audio_format: string;
}

/* ---- Intégrité de l'entretien IA (événements techniques, sans biométrie) ---- */

/** Événements techniques surveillés côté navigateur. */
export type AiIntegrityEventName =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'CAMERA_DISABLED'
  | 'MIC_DISABLED'
  | 'CAMERA_LOST'
  | 'MIC_LOST'
  | 'NETWORK_DOWN'
  | 'NETWORK_RECOVERED'
  | 'DEVTOOLS_DETECTED'
  | 'COPY_ATTEMPT'
  | 'PASTE_ATTEMPT'
  | 'DEVICE_CHANGE';

/**
 * Événement d'intégrité. UNIQUEMENT des faits techniques : pas de
 * reconnaissance faciale, pas d'analyse biométrique, pas de verdict de triche.
 */
export interface AiIntegrityEvent {
  event: AiIntegrityEventName;
  /** Horodatage ISO UTC. */
  timestamp: string;
  /** Durée (secondes), pour les événements bornés (onglet quitté, réseau coupé). */
  duration?: number;
  detail?: string;
}

/** Lot d'événements envoyé au backend (POST /entretien-ia/:token/integrity). */
export interface AiIntegrityPayload {
  events: AiIntegrityEvent[];
  /** Noms techniques des périphériques actifs (libellés, sans biométrie). */
  devices?: {
    camera?: string;
    microphone?: string;
  };
}

/** Risque anti-triche calculé côté serveur (faits techniques uniquement). */
export interface AiIntegrityRisk {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  flags: string[];
  computed_at: string | null;
}

/** Vérification de l'empreinte d'appareil (POST /entretien-ia/:token/fingerprint). */
export interface AiFingerprintResult {
  matched: boolean;
  first_time: boolean;
  risk: AiIntegrityRisk;
}

/** Synthèse d'intégrité lue par les RH (aucune donnée biométrique). */
export interface AiIntegritySummary {
  status: 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE';
  duration_seconds: number | null;
  events_count: number;
  tab_switches: number;
  fullscreen_exits: number;
  camera_disabled: number;
  mic_disabled: number;
  network_interruptions: number;
  devtools_detected: number;
  copy_attempts: number;
  paste_attempts: number;
  device_checks: number;
  device_fingerprint_changed: boolean;
  device_fingerprint: string | null;
  risk: AiIntegrityRisk;
  camera_used: string | null;
  microphone_used: string | null;
  events: AiIntegrityEvent[];
}

/* ---- Formes brutes renvoyées par l'API ---- */

export interface OffreApiRow {
  id: string;
  titre: string;
  description: string;
  duree: number;
  competences_demandees: string | null;
  nombre_places: number;
  date_limite: string;
  missions: string | null;
  technologies: string | null;
  documents_demandes: string | null;
  localisation: string | null;
  niveau: string | null;
  departement_id: string;
  departement_nom: string;
  encadrant_id: string | null;
  encadrant_nom?: string | null;
  encadrant_prenom?: string | null;
  encadrant_service?: string | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}
