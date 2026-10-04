const candidatureRepository = require('../repositories/candidature.repository');
const candidatureDocumentRepository = require('../repositories/candidature-document.repository');
const ApiError = require('../utils/error.util');
const { ONBOARDING_DOCUMENT_TYPES, effectiveDocumentStatus } = require('./onboarding-access.service');

/**
 * Codes de non-éligibilité d'un dossier. Un dossier complet (ready = true) n'a
 * aucune raison de non-éligibilité.
 */
const REASONS = {
  HUMAN_INTERVIEW_NOT_ACCEPTED: 'HUMAN_INTERVIEW_NOT_ACCEPTED',
  INTERNSHIP_PERIOD_NOT_VALIDATED: 'INTERNSHIP_PERIOD_NOT_VALIDATED',
  DOCUMENTS_INCOMPLETE: 'DOCUMENTS_INCOMPLETE',
  DOCUMENTS_INVALID: 'DOCUMENTS_INVALID'
};

/**
 * Vérification de l'éligibilité d'une candidature à la création du stagiaire.
 *
 * Ce service est la SEULE source de vérité pour le contrôle « dossier complet » :
 * il détermine l'éligibilité uniquement à partir de l'état de la base de données
 * (statut de la candidature, validation de la période, lignes `candidature_document`),
 * jamais à partir de statuts fournis par le frontend ou dans le corps de requête.
 *
 * Une candidature est prête (READY_FOR_TRAINEE) si et seulement si :
 *  1. l'entretien humain a été accepté (statut = HUMAN_INTERVIEW_ACCEPTED) ;
 *  2. la période de stage a été validée par le RH (internship_period_validated_at) ;
 *  3. chaque document requis est déposé (CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION) ;
 *  4. chaque document requis a un verdict VALID (verification_status/statut).
 *
 * Le verdict effectif d'un document est calculé par `effectiveDocumentStatus`
 * (services/onboarding-access.service.js) : rejet RH définitif > REVIEW_REQUIRED >
 * en cours de vérification (PENDING) > VALID > EN_ATTENTE > MANQUANT.
 */
class InternshipReadinessService {
  /**
   * État d'éligibilité d'une candidature.
   *
   * Sécurité :
   *  - RH / Administrateur (accès total) : n'importe quelle candidature ;
   *  - CANDIDAT : uniquement sa propre candidature (403 sinon).
   *
   * @param {string} candidatureId
   * @param {{id: string, role: string}} [currentUser] utilisateur connecté (req.user)
   * @returns {Promise<{candidature_id: string, ready: boolean, reasons: string[],
   *           documents: Array<{type, status, id?, nom?, date_depot?, verification_status?, rejected_reason?}>,
   *           missingDocuments: string[], invalidDocuments: string[]}>}
   */
  async checkInternshipReadiness(candidatureId, currentUser = null) {
    const candidature = await candidatureRepository.findByIdWithOffer(candidatureId);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    this._assertAccess(currentUser, candidature);

    const reasons = [];
    if (candidature.statut !== 'HUMAN_INTERVIEW_ACCEPTED') {
      reasons.push(REASONS.HUMAN_INTERVIEW_NOT_ACCEPTED);
    }
    if (!candidature.internship_period_validated_at) {
      reasons.push(REASONS.INTERNSHIP_PERIOD_NOT_VALIDATED);
    }

    const rows = await candidatureDocumentRepository.findByCandidatureId(candidatureId);
    const byType = new Map(rows.map((row) => [row.type, row]));

    const documents = [];
    const missingDocuments = [];
    const invalidDocuments = [];
    for (const type of ONBOARDING_DOCUMENT_TYPES) {
      const row = byType.get(type);
      const status = effectiveDocumentStatus(row);
      documents.push({
        type,
        status,
        ...(row
          ? {
              id: row.id,
              nom: row.nom,
              date_depot: row.date_depot,
              verification_status: row.verification_status,
              rejected_reason: row.rejected_reason
            }
          : {})
      });
      if (!row) {
        missingDocuments.push(type);
      } else if (status !== 'VALID') {
        invalidDocuments.push(type);
      }
    }
    if (missingDocuments.length) reasons.push(REASONS.DOCUMENTS_INCOMPLETE);
    if (invalidDocuments.length) reasons.push(REASONS.DOCUMENTS_INVALID);

    return {
      candidature_id: candidatureId,
      ready: reasons.length === 0,
      reasons,
      documents,
      missingDocuments,
      invalidDocuments
    };
  }

  /** Contrôle d'accès : RH/ADMIN accès total ; CANDIDAT uniquement sa candidature. */
  _assertAccess(currentUser, candidature) {
    if (!currentUser) return;
    if (currentUser.role === 'RH' || currentUser.role === 'ADMIN') return;
    const applicantId = candidature.stagiaire_id || candidature.candidat_id;
    if (!applicantId || applicantId !== currentUser.id) {
      throw new ApiError(403, 'Accès refusé : cette candidature ne vous appartient pas.');
    }
  }
}

module.exports = {
  InternshipReadinessService,
  internshipReadinessService: new InternshipReadinessService(),
  REASONS
};
