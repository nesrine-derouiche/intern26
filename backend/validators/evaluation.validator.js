const { body } = require('express-validator');

const createEvaluationValidation = [
  body('stage_id')
    .notEmpty().withMessage('Stage requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('technique')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 20 }).withMessage('La note technique doit être comprise entre 0 et 20.'),
  body('communication')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 20 }).withMessage('La note de communication doit être comprise entre 0 et 20.'),
  body('autonomie')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 20 }).withMessage("La note d'autonomie doit être comprise entre 0 et 20."),
  body('ponctualite')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 20 }).withMessage('La note de ponctualité doit être comprise entre 0 et 20.'),
  body('qualite')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 20 }).withMessage('La note de qualité doit être comprise entre 0 et 20.'),
  body('commentaire')
    .optional()
    .isString().withMessage('Le commentaire doit être une chaîne.')
];

module.exports = { createEvaluationValidation };
