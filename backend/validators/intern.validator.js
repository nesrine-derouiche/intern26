const { body } = require('express-validator');

const createInternValidation = [
  body('nom')
    .notEmpty().withMessage('Nom requis.')
    .isString().withMessage('Le nom doit être une chaîne.'),
  body('prenom')
    .notEmpty().withMessage('Prénom requis.')
    .isString().withMessage('Le prénom doit être une chaîne.'),
  body('email')
    .notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.'),
  body('telephone')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le téléphone doit être une chaîne.')
];

module.exports = { createInternValidation };
