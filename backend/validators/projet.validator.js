const { body } = require('express-validator');

const createProjetValidation = [
  body('stage_id')
    .notEmpty().withMessage('Le stage est requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('titre')
    .notEmpty().withMessage('Le titre est requis.')
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('technologies')
    .optional()
    .isString().withMessage('Les technologies doivent être une chaîne.'),
  body('etat')
    .optional()
    .isIn(['EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE']).withMessage('État invalide.'),
  body('avancement')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('L\'avancement doit être compris entre 0 et 100.')
];

const updateProjetValidation = [
  body('titre')
    .optional()
    .notEmpty().withMessage('Le titre ne peut pas être vide.')
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('technologies')
    .optional()
    .isString().withMessage('Les technologies doivent être une chaîne.'),
  body('etat')
    .optional()
    .isIn(['EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE']).withMessage('État invalide.'),
  body('avancement')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('L\'avancement doit être compris entre 0 et 100.')
];

module.exports = { createProjetValidation, updateProjetValidation };
