const { body, param } = require('express-validator');

const createApplicationValidation = [
  body('stagiaire_id')
    .optional({ values: 'null' })
    .isUUID().withMessage('ID stagiaire invalide.'),
  body('offre_id')
    .notEmpty().withMessage('Offre requise.')
    .isUUID().withMessage('ID offre invalide.')
];

const updateApplicationStatusValidation = [
  body('statut')
    .notEmpty().withMessage('Statut requis.')
    .isIn(['EN_ENTRETIEN_IA', 'RH_ACCEPTED', 'ACCEPTEE', 'REFUSEE'])
    .withMessage('Le statut doit être EN_ENTRETIEN_IA, RH_ACCEPTED, ACCEPTEE ou REFUSEE.')
];

const stagePreferencesValidation = [
  body('internship_start_date')
    .notEmpty().withMessage('La date de début du stage est requise.')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('La date de début du stage doit être au format YYYY-MM-DD.'),
  body('internship_duration_months')
    .notEmpty().withMessage('La durée du stage est requise.')
    .isInt({ min: 1, max: 24 }).withMessage('La durée du stage doit être un nombre de mois entier entre 1 et 24.')
];

const onboardingDocumentTypes = ['CV', 'CIN', 'DEMANDE_STAGE', 'LETTRE_AFFECTATION'];

const onboardingDocumentValidation = [
  param('type')
    .notEmpty().withMessage('Type de document requis.')
    .isIn(onboardingDocumentTypes)
    .withMessage('Le type de document doit être CV, CIN, DEMANDE_STAGE ou LETTRE_AFFECTATION.')
];

/**
 * Décision RH de vérification manuelle d'un document du dossier.
 * Seuls les états VALID (valider) et REJECTED (rejeter) sont autorisés en
 * manuel : PENDING / REVIEW_REQUIRED restent réservés au workflow automatique.
 * `rejected_reason` (facultatif, 500 caractères max) documente un rejet.
 */
const documentVerificationDecisionValidation = [
  param('documentId')
    .isUUID().withMessage('Identifiant de document invalide.'),
  body('status')
    .notEmpty().withMessage('Décision requise.')
    .isIn(['VALID', 'REJECTED'])
    .withMessage('La décision doit être VALID ou REJECTED.'),
  body('rejected_reason')
    .optional({ values: 'null' })
    .isString().withMessage('Le motif de rejet doit être un texte.')
    .trim()
    .isLength({ max: 500 }).withMessage('Le motif de rejet ne doit pas dépasser 500 caractères.')
];

/** Téléchargement d'un document du dossier : l'identifiant doit être un UUID valide. */
const documentDownloadValidation = [
  param('documentId')
    .isUUID().withMessage('Identifiant de document invalide.')
];

module.exports = { createApplicationValidation, updateApplicationStatusValidation, stagePreferencesValidation, onboardingDocumentValidation, documentVerificationDecisionValidation, documentDownloadValidation, onboardingDocumentTypes };
