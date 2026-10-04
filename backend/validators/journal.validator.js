const { body } = require('express-validator');

const createJournalValidation = [
  body('stage_id')
    .notEmpty().withMessage('Stage requis.')
    .isUUID().withMessage('ID stage invalide.'),
  body('semaine')
    .notEmpty().withMessage('Semaine requise.')
    .isISO8601().withMessage('La date de la semaine est invalide.'),
  body('travaux')
    .notEmpty().withMessage('Les travaux réalisés sont requis.')
    .isString().withMessage('Les travaux réalisés doivent être une chaîne.'),
  body('difficultes')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les difficultés doivent être une chaîne.'),
  body('solutions')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les solutions doivent être une chaîne.'),
  body('competences')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les compétences acquises doivent être une chaîne.'),
  body('heures')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 168 }).withMessage('Le nombre d\'heures doit être compris entre 0 et 168.'),
  body('commentaire')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le commentaire doit être une chaîne.')
];

const updateJournalValidation = [
  body('travaux')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les travaux réalisés doivent être une chaîne.'),
  body('difficultes')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les difficultés doivent être une chaîne.'),
  body('solutions')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les solutions doivent être une chaîne.'),
  body('competences')
    .optional({ values: 'falsy' })
    .isString().withMessage('Les compétences acquises doivent être une chaîne.'),
  body('heures')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: 168 }).withMessage('Le nombre d\'heures doit être compris entre 0 et 168.'),
  body('commentaire')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le commentaire doit être une chaîne.')
];

const validateJournalValidation = [
  body('commentaire_encadrant')
    .optional({ values: 'falsy' })
    .isString().withMessage('Le commentaire de l\'encadrant doit être une chaîne.')
];

module.exports = {
  createJournalValidation,
  updateJournalValidation,
  validateJournalValidation
};
