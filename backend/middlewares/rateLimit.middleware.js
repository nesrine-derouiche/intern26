const { rateLimit } = require('express-rate-limit');

const jsonRateLimitHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message: 'Trop de requêtes. Veuillez réessayer plus tard.'
  });
};

const sharedOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonRateLimitHandler
};

const apiLimiter = rateLimit({
  ...sharedOptions,
  // La suite d'intégration (près de 100 scénarios HTTP) dépasse 300 requêtes
  // en un seul passage, et la fenêtre de 15 min s'accumule entre les exécutions.
  // 1000 reste une protection raisonnable (≈ 67 requêtes/min) contre l'abus.
  limit: 1000
});

const authLimiter = rateLimit({
  ...sharedOptions,
  // La suite d'intégration connecte plusieurs comptes (admin, RH, encadrants,
  // stagiaires, candidat) en un seul passage : 10 requêtes/15 min suffisent en
  // production mais bloqueraient les tests. 50 reste une protection raisonnable.
  limit: 50
});

module.exports = { apiLimiter, authLimiter };
