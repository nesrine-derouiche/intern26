const { body } = require('express-validator');

const registerDeviceToken = [
  body('token')
    .isString()
    .withMessage('Le jeton de notification est requis.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Le jeton de notification est invalide.'),
  body('platform')
    .optional()
    .isString()
    .withMessage('La plateforme est invalide.')
    .bail()
    .isIn(['android', 'ios', 'web'])
    .withMessage('La plateforme doit être android, ios ou web.'),
];

const unregisterDeviceToken = [
  body('token')
    .isString()
    .withMessage('Le jeton de notification est requis.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Le jeton de notification est invalide.'),
];

module.exports = { registerDeviceToken, unregisterDeviceToken };
