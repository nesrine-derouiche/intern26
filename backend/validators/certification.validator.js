const { body, param } = require('express-validator');

/**
 * Validation de structure HTTP uniquement.
 *
 * Les règles métier (machine à états, motifs obligatoires, propriété,
 * validation PDF) restent l'apanage exclusif de
 * `services/certification.service.js`.
 */

const kindParamValidation = [
  param('kind')
    .isIn(['JOURNAL', 'RAPPORT']).withMessage('Type de document invalide. Valeurs : JOURNAL, RAPPORT.')
];

const docIdParamValidation = [
  param('docId')
    .isUUID().withMessage('Identifiant de document invalide.')
];

const denyValidation = [
  body('reason')
    .notEmpty().withMessage('Un motif est requis pour refuser le dossier.')
    .isString().withMessage('Le motif doit être une chaîne.')
];

const redoValidation = [
  body('reason')
    .notEmpty().withMessage('Un motif est requis pour demander une reprise.')
    .isString().withMessage('Le motif doit être une chaîne.'),

  body('document_concerne')
    .optional({ values: 'null' })
    .isIn(['JOURNAL', 'RAPPORT']).withMessage('Document concerné invalide. Valeurs : JOURNAL, RAPPORT.')
];

module.exports = {
  kindParamValidation,
  docIdParamValidation,
  denyValidation,
  redoValidation
};
