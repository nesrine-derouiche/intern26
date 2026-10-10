const { body, param } = require('express-validator');

/**
 * Validation de structure HTTP uniquement.
 *
 * Les règles métier (propriétaire dérivé de la session, isolement,
 * idempotence) restent l'apanage exclusif de `services/note.service.js`.
 */

const noteIdParamValidation = [
  param('id')
    .isUUID().withMessage('Identifiant de note invalide.')
];

const createNoteValidation = [
  body('titre')
    .optional()
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),

  body('contenu')
    .optional()
    .isString().withMessage('Le contenu doit être une chaîne.'),

  body('pinned')
    .optional()
    .isBoolean().withMessage('Le champ « pinned » doit être un booléen.'),

  body('client_key')
    .optional({ values: 'null' })
    .isString().withMessage('Le champ « client_key » doit être une chaîne.')
];

const updateNoteValidation = [
  body('titre')
    .optional()
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),

  body('contenu')
    .optional()
    .isString().withMessage('Le contenu doit être une chaîne.'),

  body('pinned')
    .optional()
    .isBoolean().withMessage('Le champ « pinned » doit être un booléen.')
];

module.exports = {
  noteIdParamValidation,
  createNoteValidation,
  updateNoteValidation
};
