const { body } = require('express-validator');

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mot de passe requis.')
];

const passwordValidation = [
  body('password')
    .notEmpty().withMessage('Mot de passe requis.')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir une lettre majuscule.')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir une lettre minuscule.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir un chiffre.')
];

const registerValidation = [
  body('nom')
    .trim().notEmpty().withMessage('Nom requis.')
    .isLength({ max: 100 }).withMessage('Nom trop long.'),
  body('prenom')
    .trim().notEmpty().withMessage('Prénom requis.')
    .isLength({ max: 100 }).withMessage('Prénom trop long.'),
  body('email')
    .trim().notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.')
    .normalizeEmail(),
  ...passwordValidation,
  body('telephone').optional({ values: 'falsy' }).isString().isLength({ max: 30 }),
  body('adresse').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
  body('universite').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
  body('specialite').optional({ values: 'falsy' }).isString().isLength({ max: 150 }),
  body('niveau').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  body('competences')
    .optional()
    .custom((v) => {
      if (Array.isArray(v)) return v.every((s) => typeof s === 'string');
      return typeof v === 'string';
    }).withMessage('Compétences doivent être une liste de textes.'),
  body('langues')
    .optional()
    .custom((v) => {
      if (Array.isArray(v)) return v.every((s) => typeof s === 'string');
      return typeof v === 'string';
    }).withMessage('Langues doivent être une liste de textes.'),
  body('github').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL GitHub invalide.'),
  body('linkedin').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL LinkedIn invalide.'),
  body('portfolio').optional({ values: 'falsy' }).isURL({ require_protocol: false }).withMessage('URL portfolio invalide.')
];

const verifyEmailValidation = [
  body('token').notEmpty().withMessage('Jeton requis.')
];

const resendVerificationValidation = [
  body('email')
    .trim().notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.')
    .normalizeEmail()
];

const forgotPasswordValidation = [
  body('email')
    .trim().notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Jeton requis.'),
  ...passwordValidation
];

const profileUpdateValidation = [
  body('nom')
    .optional()
    .trim().notEmpty().withMessage('Nom requis.')
    .isLength({ max: 100 }).withMessage('Nom trop long.'),
  body('prenom')
    .optional()
    .trim().notEmpty().withMessage('Prénom requis.')
    .isLength({ max: 100 }).withMessage('Prénom trop long.'),
  body('telephone')
    .optional({ values: 'falsy' })
    .isString().withMessage('Téléphone invalide.')
    .isLength({ max: 30 }).withMessage('Téléphone trop long.'),
  body('adresse')
    .optional({ values: 'falsy' })
    .isString().withMessage('Adresse invalide.')
    .isLength({ max: 255 }).withMessage('Adresse trop longue.')
];

const changePasswordValidation = [
  body('current_password')
    .notEmpty().withMessage('Mot de passe actuel requis.'),
  body('new_password')
    .notEmpty().withMessage('Nouveau mot de passe requis.')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir une lettre majuscule.')
    .matches(/[a-z]/).withMessage('Le mot de passe doit contenir une lettre minuscule.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir un chiffre.'),
  body('confirm_password')
    .notEmpty().withMessage('Confirmation du mot de passe requise.')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Les mots de passe ne correspondent pas.');
      }
      return true;
    })
];

module.exports = {
  loginValidation,
  registerValidation,
  verifyEmailValidation,
  resendVerificationValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  profileUpdateValidation,
  changePasswordValidation
};
