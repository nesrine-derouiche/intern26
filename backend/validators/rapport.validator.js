const { body } = require('express-validator');

const createRapportValidation = [
  body('stage_id')
    .notEmpty().withMessage('Le stage est requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('type')
    .notEmpty().withMessage('Le type est requis.')
    .isIn(['INTERMEDIAIRE', 'FINAL']).withMessage('Type de rapport invalide.'),
  body('contenu')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le contenu doit être une chaîne.')
];

const updateRapportValidation = [
  body('contenu')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le contenu doit être une chaîne.'),
  body('type')
    .optional()
    .isIn(['INTERMEDIAIRE', 'FINAL']).withMessage('Type de rapport invalide.')
];

const rejectRapportValidation = [
  body('commentaire')
    .notEmpty().withMessage('Un commentaire est requis lors du rejet.')
    .isString().withMessage('Le commentaire doit être une chaîne.')
    .isLength({ min: 1 }).withMessage('Le commentaire ne peut pas être vide.')
];

module.exports = { createRapportValidation, updateRapportValidation, rejectRapportValidation };
