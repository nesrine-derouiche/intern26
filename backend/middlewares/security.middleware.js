const helmet = require('helmet');

const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
});

const securityHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()'
  );
  next();
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
};

module.exports = {
  helmetMiddleware,
  securityHeaders,
  notFoundHandler
};
