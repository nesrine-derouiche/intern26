const logger = require('../utils/logger');

const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.code === '23505') {
    statusCode = 400;
    message = 'Une entrée avec cette valeur existe déjà.';
  }

  if (statusCode === 500) {
    logger.error('Unhandled error:', err);
  } else {
    logger.warn(`[${statusCode}] ${message}`);
  }

  const response = { success: false, message };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = globalErrorHandler;
