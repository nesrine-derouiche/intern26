const { body } = require('express-validator');

const createDepartmentValidation = [
  body('nom')
    .notEmpty().withMessage('Le nom est requis.')
    .isString().withMessage('Le nom doit être une chaîne.')
];

const updateDepartmentValidation = [
  body('nom')
    .optional()
    .notEmpty().withMessage('Le nom ne peut pas être vide.')
    .isString().withMessage('Le nom doit être une chaîne.')
];

module.exports = { createDepartmentValidation, updateDepartmentValidation };
