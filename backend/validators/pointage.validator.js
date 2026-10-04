const { body, param, query } = require('express-validator');

const createPointageValidation = [
  body('stage_id')
    .isUUID().withMessage('stage_id doit être un UUID valide.')
];

const corrigerPointageValidation = [
  body('heure_entree')
    .optional()
    .isISO8601().withMessage('heure_entree doit être une date ISO 8601 valide.'),
  body('heure_sortie')
    .optional()
    .isISO8601().withMessage('heure_sortie doit être une date ISO 8601 valide.'),
  body('retard_minutes')
    .optional()
    .isInt({ min: 0 }).withMessage('retard_minutes doit être un entier positif ou nul.'),
  body('statut')
    .optional()
    .isIn(['PRESENT', 'RETARD', 'ABSENT']).withMessage('statut doit être PRESENT, RETARD ou ABSENT.'),
  body('commentaire')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }).withMessage('commentaire ne peut dépasser 500 caractères.')
];

const upsertHoraireValidation = [
  body('heure_debut')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('heure_debut doit être au format HH:MM (00:00-23:59).'),
  body('heure_fin')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('heure_fin doit être au format HH:MM (00:00-23:59).'),
  body('duree_pause_minutes')
    .optional()
    .isInt({ min: 0, max: 480 }).withMessage('duree_pause_minutes doit être entre 0 et 480.')
];

module.exports = {
  createPointageValidation,
  corrigerPointageValidation,
  upsertHoraireValidation
};
