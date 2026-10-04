const { body } = require('express-validator');

const createSupervisorValidation = [
  body('nom')
    .notEmpty().withMessage('Nom requis.')
    .isString().withMessage('Le nom doit être une chaîne.'),
  body('prenom')
    .notEmpty().withMessage('Prénom requis.')
    .isString().withMessage('Le prénom doit être une chaîne.'),
  body('email')
    .notEmpty().withMessage('Email requis.')
    .isEmail().withMessage('Email invalide.')
];

module.exports = { createSupervisorValidation };
