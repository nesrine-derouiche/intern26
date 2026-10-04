const { query } = require('express-validator');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const getPlanningValidation = [
  query('stage_id')
    .optional({ values: 'falsy' })
    .isUUID().withMessage('stage_id doit être un UUID valide.'),

  // strict + strictSeparator : seule une date calendairement réelle est acceptée
  // (2026-02-29 / 2026-02-31 / 2026-04-31 sont rejetés → 400 et non 500 côté PostgreSQL).
  query('date_debut')
    .optional({ values: 'falsy' })
    .matches(ISO_DATE).withMessage('date_debut doit être au format AAAA-MM-JJ.')
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('date_debut doit être une date calendairement valide.'),

  query('date_fin')
    .optional({ values: 'falsy' })
    .matches(ISO_DATE).withMessage('date_fin doit être au format AAAA-MM-JJ.')
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('date_fin doit être une date calendairement valide.')
    .custom((value, { req }) => {
      const debut = req.query.date_debut;
      if (debut && String(debut) > String(value)) {
        throw new Error('date_debut doit être antérieure ou égale à date_fin.');
      }
      return true;
    }),

  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 }).withMessage('page doit être un entier positif supérieur ou égal à 1.'),

  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 500 }).withMessage('limit doit être un entier compris entre 1 et 500.')
];

module.exports = { getPlanningValidation };
