const { body } = require('express-validator');

const candidatUpdateValidation = [
  body('telephone').optional({ values: 'falsy' }).isString().isLength({ max: 30 }).withMessage('Téléphone invalide.'),
  body('adresse').optional({ values: 'falsy' }).isString().isLength({ max: 255 }).withMessage('Adresse invalide.'),
  body('universite').optional({ values: 'falsy' }).isString().isLength({ max: 255 }).withMessage('Université invalide.'),
  body('specialite').optional({ values: 'falsy' }).isString().isLength({ max: 150 }).withMessage('Spécialité invalide.'),
  body('niveau').optional({ values: 'falsy' }).isString().isLength({ max: 50 }).withMessage('Niveau invalide.'),
  body('competences').optional().isArray().withMessage('Compétences doivent être une liste.'),
  body('competences.*').isString().isLength({ max: 100 }),
  body('langues').optional().isArray().withMessage('Langues doivent être une liste.'),
  body('langues.*').isString().isLength({ max: 50 }),
  body('github').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL GitHub invalide.'),
  body('linkedin').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL LinkedIn invalide.'),
  body('portfolio').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL portfolio invalide.')
];

const candidatEmailUpdateValidation = [
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email invalide.')
    .normalizeEmail()
];

const candidatPasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Mot de passe actuel requis.'),
  body('newPassword')
    .notEmpty().withMessage('Mot de passe requis.')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir une lettre majuscule.')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir une lettre minuscule.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir un chiffre.')
];

module.exports = { candidatUpdateValidation, candidatEmailUpdateValidation, candidatPasswordValidation };
