const { body } = require('express-validator');

const updateStageValidation = [
  body('statut')
    .optional()
    .isIn(['EN_COURS', 'TERMINE', 'SUSPENDU', 'ANNULE']).withMessage('Statut de stage invalide.')
];

module.exports = { updateStageValidation };
