const candidatureRepository = require('../repositories/candidature.repository');
const candidatureDocumentRepository = require('../repositories/candidature-document.repository');
const ApiError = require('../utils/error.util');

/** Documents requis du dossier de candidature (ordre stable pour l'affichage). */
const ONBOARDING_DOCUMENT_TYPES = ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];

/** Clé courte exposée dans l'API (contrat du garde d'accès). */
const TYPE_KEYS = {
  CV: 'cv',
  CIN: 'cin',
  DEMANDE_STAGE: 'demande_stage',
  LETTRE_AFFECTATION: 'lettre_affectation'
};

/**
 * Statut effectif d'un document pour le garde d'accès.
 *
 * Le verdict de vérification automatique (`verification_status`) prime sur le
 * statut du workflow RH (`statut`), sauf pour un rejet RH qui reste définitif.
 * Priorité : REJECTED > REVIEW_REQUIRED > VERIFICATION > VALID > EN_ATTENTE,
 * et MANQUANT quand aucun document n'est déposé.
 */
function effectiveDocumentStatus(row) {
  if (!row) return 'MANQUANT';
  const verification = row.verification_status;
  if (row.statut === 'REJETE' || verification === 'REJECTED') return 'REJECTED';
  if (verification === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (verification === 'PENDING') return 'VERIFICATION';
  if (row.statut === 'VALIDE' || verification === 'VALID') return 'VALID';
  return 'EN_ATTENTE';
}

/** La candidature est-elle dans la fenêtre d'onboarding (dépôt des documents requis) ? */
function isOnboardingWindow(row) {
  return !!row && row.statut === 'HUMAN_INTERVIEW_ACCEPTED' && !!row.internship_period_validated_at;
}

/** Construit l'état d'accès à partir des documents d'une candidature. */
function documentsAccess(rows) {
  const byType = new Map((rows || []).map((row) => [row.type, row]));
  const documents = {};
  for (const type of ONBOARDING_DOCUMENT_TYPES) {
    documents[TYPE_KEYS[type]] = effectiveDocumentStatus(byType.get(type));
  }
  return {
    accessGranted: Object.values(documents).every((status) => status === 'VALID'),
    documents
  };
}

function allValidDocuments() {
  const documents = {};
  for (const type of ONBOARDING_DOCUMENT_TYPES) {
    documents[TYPE_KEYS[type]] = 'VALID';
  }
  return documents;
}

class OnboardingAccessService {
  /**
   * État d'accès d'une candidature pour le candidat connecté.
   *
   * Sécurité :
   *  - réservé au candidat (vérifié aussi par la route) ;
   *  - la candidature doit appartenir au candidat connecté (403 sinon) ;
   *  - hors fenêtre d'onboarding → accès accordé (aucun dossier exigé) ;
   *  - dans la fenêtre d'onboarding → accès accordé uniquement si les 4
   *    documents sont VALID.
   */
  async getInternshipAccess(candidatureId, currentUser) {
    if (!currentUser || currentUser.role !== 'CANDIDAT') {
      throw new ApiError(403, 'Seul le candidat propriétaire de la candidature peut consulter son accès.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(candidatureId);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    const applicantId = candidature.stagiaire_id || candidature.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }

    if (!isOnboardingWindow(candidature)) {
      return { access_granted: true, documents: allValidDocuments() };
    }

    const rows = await candidatureDocumentRepository.findByCandidatureId(candidatureId);
    const { accessGranted, documents } = documentsAccess(rows);
    return { access_granted: accessGranted, documents };
  }

  /**
   * Garde serveur : le candidat a-t-il le droit d'accéder à son espace stage ?
   *
   * Seuls les candidats sont concernés. Un candidat sans candidature en cours
   * d'onboarding n'est jamais bloqué ; un candidat dans la fenêtre d'onboarding
   * n'est débloqué que lorsque les 4 documents sont VALID. Les autres rôles ne
   * sont jamais affectés par ce garde.
   */
  async hasInternshipAccess(user) {
    if (!user || user.role !== 'CANDIDAT') return true;
    const rows = await candidatureRepository.findByCandidat(user.id);
    const active = (rows || []).find(isOnboardingWindow);
    if (!active) return true;
    const documents = await candidatureDocumentRepository.findByCandidatureId(active.id);
    return documentsAccess(documents).accessGranted;
  }
}

module.exports = {
  OnboardingAccessService,
  onboardingAccessService: new OnboardingAccessService(),
  ONBOARDING_DOCUMENT_TYPES,
  TYPE_KEYS,
  effectiveDocumentStatus,
  isOnboardingWindow,
  documentsAccess
};
