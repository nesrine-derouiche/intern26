const db = require('../config/db');
const ApiError = require('../utils/error.util');
const { addCalendarMonths } = require('../utils/stage-period.util');
const candidatureRepository = require('../repositories/candidature.repository');
const candidatRepository = require('../repositories/candidat.repository');
const stagiaireRepository = require('../repositories/stagiaire.repository');
const stageRepository = require('../repositories/stage.repository');
const offreRepository = require('../repositories/offre.repository');
const encadrantRepository = require('../repositories/encadrant.repository');
const { internshipReadinessService } = require('./internship-readiness.service');

/** Statut marquant la conversion effective (candidat → stagiaire). */
const CONVERTED_STATUS = 'STAGIAIRE_CREATED';

/** Messages d'erreur (400) associés aux raisons de non-éligibilité du dossier. */
const READINESS_REASON_MESSAGES = {
  HUMAN_INTERVIEW_NOT_ACCEPTED: "l'entretien humain n'a pas été accepté",
  INTERNSHIP_PERIOD_NOT_VALIDATED: 'la période de stage n\'a pas été validée par le RH',
  DOCUMENTS_INCOMPLETE: 'des documents du dossier sont manquants',
  DOCUMENTS_INVALID: 'des documents du dossier sont invalides'
};

/**
 * Conversion d'une candidature « dossier prêt » (READY_FOR_TRAINEE) en stagiaire.
 *
 * Cette étape transforme définitivement le candidat accepté (après onboarding
 * complet : entretien humain accepté, période validée, 4 documents VALID) en
 * stagiaire :
 *  - fiche stagiaire créée à partir du profil candidat (même utilisateur) ;
 *  - rôle `CANDIDAT` → `STAGIAIRE` sur l'utilisateur existant ;
 *  - stage créé (date de début/durée de la période validée, offre, département,
 *    encadrant) avec son projet initial ;
 *  - candidature liée au stagiaire et passée en `STAGIAIRE_CREATED` ;
 *  - entrée d'audit (action TRAINEE_CREATED) dans candidature_decisions.
 *
 * Sécurité :
 *  - réservé au RH / Administrateur (403) ;
 *  - l'éligibilité est recalculée UNIQUEMENT depuis la base par
 *    `internshipReadinessService` : aucun statut ni document du corps de
 *    requête n'est pris en compte ;
 *  - idempotent : une conversion déjà effectuée est restituée telle quelle
 *    (aucun doublon de stagiaire, de stage ni de conversion).
 *
 * Le tout s'exécute dans une transaction : toute erreur annule intégralement
 * la conversion (stagiaire, rôle, candidature, stage, audit, places).
 */
class InternshipConversionService {
  /**
   * Convertit une candidature en stagiaire (transaction atomique).
   *
   * @param {string} candidatureId
   * @param {{id: string, role: string}} currentUser utilisateur connecté (req.user)
   * @returns {Promise<{candidature_id, statut, already_converted, stagiaire_id,
   *           stage_id, stagiaire, stage}>}
   */
  async convertCandidatureToStagiaire(candidatureId, currentUser) {
    if (!currentUser || (currentUser.role !== 'RH' && currentUser.role !== 'ADMIN')) {
      throw new ApiError(403, 'Seul un RH ou un Administrateur peut créer le stagiaire.');
    }

    const candidature = await candidatureRepository.findByIdWithOffer(candidatureId);
    if (!candidature) throw new ApiError(404, 'Candidature introuvable.');

    const existing = await this._findExistingConversion(candidature);
    if (existing) {
      return { ...existing, already_converted: true };
    }

    const readiness = await internshipReadinessService.checkInternshipReadiness(candidatureId);
    if (!readiness.ready) {
      throw new ApiError(400, this._notReadyMessage(readiness.reasons));
    }

    if (!candidature.internship_start_date || candidature.internship_duration_months == null) {
      throw new ApiError(400, 'La période de stage validée est incomplète : date de début ou durée manquante.');
    }

    const offre = await offreRepository.findPublicById(candidature.offre_id);
    const encadrantId = (offre && offre.encadrant_id) || (await this._findAvailableEncadrant(candidature.departement_id));
    if (!encadrantId) {
      throw new ApiError(400, 'Impossible de créer le stagiaire : aucun encadrant disponible.');
    }

    const startDate = this._formatIsoDate(candidature.internship_start_date);
    const endDate = this._formatIsoDate(this._computeEndDate(
      candidature.internship_start_date,
      candidature.internship_duration_months
    ));
    const offreTitre = (offre && offre.titre) || candidature.offre_titre;

    const { stagiaireId, stageId } = await db.withTransaction(async (client) => {
      let stagiaireId = candidature.stagiaire_id;
      if (!stagiaireId && candidature.candidat_id) {
        const profile = await candidatRepository.getProfile(candidature.candidat_id);
        if (!profile) {
          throw new ApiError(400, 'Impossible de créer le stagiaire : profil candidat introuvable.');
        }
        await candidatRepository.createStagiaire(candidature.candidat_id, profile, client);
        await this._promoteRole(candidature.candidat_id, client);
        stagiaireId = candidature.candidat_id;
      }
      if (!stagiaireId) {
        throw new ApiError(400, 'Impossible de créer le stagiaire : aucun candidat associé à la candidature.');
      }

      await candidatureRepository.updateStatut(candidatureId, CONVERTED_STATUS, client);
      await candidatureRepository.updateStagiaire(candidatureId, stagiaireId, client);
      const stageId = await stageRepository.createWithProject(
        candidatureId, stagiaireId, encadrantId,
        candidature.departement_id, candidature.offre_id,
        startDate, endDate, offreTitre, client
      );
      await offreRepository.decrementPlaces(candidature.offre_id, client);
      await candidatureRepository.insertStagePeriodAudit(candidatureId, {
        decision: 'CONVERTED',
        action: 'TRAINEE_CREATED',
        decidedBy: currentUser.id,
        previousStatus: candidature.statut,
        newStatus: CONVERTED_STATUS,
        startDate: candidature.internship_start_date,
        durationMonths: Number(candidature.internship_duration_months)
      });

      return { stagiaireId, stageId };
    });

    const stageRow = await stageRepository.findByCandidatureId(candidatureId);
    const profile = await stagiaireRepository.findById(stagiaireId);

    return {
      candidature_id: candidatureId,
      statut: CONVERTED_STATUS,
      already_converted: false,
      stagiaire_id: stagiaireId,
      stage_id: stageId,
      reauth_required: true,
      stagiaire: profile
        ? { id: profile.id, nom: profile.nom, prenom: profile.prenom, email: profile.email }
        : { id: stagiaireId },
      stage: this._shapeStage(candidature, stageRow)
    };
  }

  /**
   * Conversion déjà effectuée (statut STAGIAIRE_CREATED ou stage existant).
   * Retourne la conversion existante, sinon null. La contrainte UNIQUE
   * `stage.candidature_id` garantit l'absence de doublon.
   */
  async _findExistingConversion(candidature) {
    const stage = await stageRepository.findByCandidatureId(candidature.id);
    if (!stage) return null;

    const profile = await stagiaireRepository.findById(stage.stagiaire_id);
    return {
      candidature_id: candidature.id,
      statut: CONVERTED_STATUS,
      stagiaire_id: stage.stagiaire_id,
      stage_id: stage.id,
      stagiaire: profile
        ? { id: profile.id, nom: profile.nom, prenom: profile.prenom, email: profile.email }
        : { id: stage.stagiaire_id },
      stage: this._shapeStage(candidature, stage)
    };
  }

  /** Forme normalisée du stage créé pour la réponse API. */
  _shapeStage(candidature, stage) {
    return {
      id: stage.id,
      date_debut: this._formatIsoDate(stage.date_debut),
      date_fin: this._formatIsoDate(stage.date_fin),
      duree_mois: candidature && candidature.internship_duration_months != null
        ? Number(candidature.internship_duration_months)
        : null,
      statut: stage.statut,
      offre_titre: stage.offre_titre,
      departement_nom: stage.departement_nom,
      encadrant: stage.encadrant_id
        ? { id: stage.encadrant_id, nom: stage.encadrant_nom, prenom: stage.encadrant_prenom }
        : null
    };
  }

  /** Promotion d'un candidat du portail en stagiaire (même utilisateur). */
  async _promoteRole(userId, client) {
    await client.query(
      "UPDATE utilisateur SET role = 'STAGIAIRE', token_version = token_version + 1 WHERE id = $1",
      [userId]
    );
  }

  /** Encadrant de l'offre, sinon encadrant disponible du département (fallback global). */
  async _findAvailableEncadrant(departementId) {
    const match = await encadrantRepository.findAvailableByDepartment(departementId);
    if (match) return match.id;
    const fallback = await encadrantRepository.findAnyAvailable();
    if (fallback) return fallback.id;
    return null;
  }

  /**
   * Fin de stage = début + durée en mois calendaires. Délègue au module
   * canonique `stage-period.util` (arithmétique calendaire sans fuseau
   * horaire, clampée au dernier jour du mois cible : 31/01 + 1 mois → fin février).
   */
  _computeEndDate(startDate, months) {
    return addCalendarMonths(this._formatIsoDate(startDate), months);
  }

  /**
   * Date au format YYYY-MM-DD. Les colonnes DATE lues via node-postgres sont
   * des instants « minuit local » : on utilise donc les getters LOCAUX pour
   * reproduire exactement la date stockée, quel que soit le fuseau du serveur.
   */
  _formatIsoDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Message d'erreur (400) listant les raisons de non-éligibilité du dossier. */
  _notReadyMessage(reasons) {
    const parts = (reasons || []).map((r) => READINESS_REASON_MESSAGES[r] || r);
    return `Impossible de créer le stagiaire : ${parts.join(' ; ')}.`;
  }
}

module.exports = {
  InternshipConversionService,
  internshipConversionService: new InternshipConversionService()
};
