const { body } = require('express-validator');

const createTaskValidation = [
  body('projet_id')
    .notEmpty().withMessage('Projet requis.')
    .isUUID().withMessage('ID projet invalide.'),
  body('executant_id')
    .notEmpty().withMessage('Exécutant requis.')
    .isUUID().withMessage('ID exécutant invalide.'),
  body('titre')
    .notEmpty().withMessage('Titre requis.')
    .isString().withMessage('Le titre doit être une chaîne.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('priorite')
    .optional()
    .isIn(['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE']).withMessage('Priorité invalide.'),
  body('date_debut')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date de début invalide.'),
  body('date_fin')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date de fin invalide.')
];

const updateTaskValidation = [
  body('titre')
    .optional()
    .isString().withMessage('Le titre doit être une chaîne.'),
  body('description')
    .optional()
    .isString().withMessage('La description doit être une chaîne.'),
  body('priorite')
    .optional()
    .isIn(['BASSE', 'MOYENNE', 'HAUTE', 'URGENTE']).withMessage('Priorité invalide.'),
  body('statut')
    .optional()
    .isIn(['A_FAIRE', 'EN_COURS', 'TERMINEE', 'BLOQUEE']).withMessage('Statut de tâche invalide.'),
  body('date_debut')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date de début invalide.'),
  body('date_fin')
    .optional({ values: 'falsy' })
    .isDate().withMessage('Date de fin invalide.'),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('La progression doit être comprise entre 0 et 100.'),
  body('estimated_hours')
    .optional()
    .isFloat()
    .custom(v => v > 0).withMessage('Les heures estimées doivent être strictement supérieures à 0.'),
  body('spent_hours')
    .optional()
    .isFloat({ min: 0 }).withMessage('Les heures passées doivent être un nombre positif.')
];

module.exports = { createTaskValidation, updateTaskValidation };
