const { body } = require('express-validator');

const createPersonalTaskValidation = [
  body('titre')
    .notEmpty().withMessage('Titre requis.')
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('priorite')
    .optional()
    .isIn(['BASSE', 'MOYENNE', 'HAUTE']).withMessage('Priorité invalide. Valeurs : BASSE, MOYENNE, HAUTE.'),
  body('date_echeance')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date d\'échéance invalide.'),
];

const updatePersonalTaskValidation = [
  body('titre')
    .optional()
    .isString().withMessage('Le titre doit être une chaîne.')
    .isLength({ max: 200 }).withMessage('Le titre ne doit pas dépasser 200 caractères.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('priorite')
    .optional()
    .isIn(['BASSE', 'MOYENNE', 'HAUTE']).withMessage('Priorité invalide. Valeurs : BASSE, MOYENNE, HAUTE.'),
  body('date_echeance')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date d\'échéance invalide.'),
];

const movePersonalTaskValidation = [
  body('statut')
    .optional()
    .isIn(['A_FAIRE', 'EN_COURS', 'TERMINEE']).withMessage('Statut invalide. Valeurs : A_FAIRE, EN_COURS, TERMINEE.'),
  body('position')
    .optional()
    .isInt({ min: 0 }).withMessage('Position invalide doit être un entier ≥ 0.'),
];

module.exports = {
  createPersonalTaskValidation,
  updatePersonalTaskValidation,
  movePersonalTaskValidation,
};
