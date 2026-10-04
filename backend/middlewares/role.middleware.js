const ApiError = require('../utils/error.util');

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Non authentifié.'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Accès refusé. Rôles autorisés : ${roles.join(', ')}.`));
    }
    
    next();
  };
};

module.exports = {
  requireRole
};
