const jwt = require('jsonwebtoken');
const ApiError = require('../utils/error.util');
const pool = require('../config/db');
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return next(new ApiError(401, 'Token d\'accès requis.'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Tout jeton émis par le serveur porte token_version (generateToken).
    // Un jeton sans token_version est rejeté : sinon la vérification de
    // session serait court-circuitée et un tel jeton ne serait jamais révoqué.
    if (decoded.token_version == null) {
      return next(new ApiError(401, 'Token invalide ou expiré.'));
    }

    // Valider token_version : si le rôle a changé (ex: conversion CANDIDAT → STAGIAIRE),
    // si le mot de passe a été changé/réinitialisé, l'ancien token doit être rejeté.
    // Le client doit se reconnecter.
    const { rows } = await pool.query(
      'SELECT token_version FROM utilisateur WHERE id = $1',
      [decoded.id]
    );
    if (!rows[0] || rows[0].token_version !== decoded.token_version) {
      return next(new ApiError(401, 'Votre session a expiré. Veuillez vous reconnecter.'));
    }

    req.user = decoded;
    next();
  } catch (error) {
    // Un jeton expiré ou invalide est un échec d'authentification (401),
    // distinct d'un refus d'autorisation (403, géré par requireRole/withScope).
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Votre session a expiré. Veuillez vous reconnecter.'));
    }
    return next(new ApiError(401, 'Token invalide ou expiré.'));
  }
};

module.exports = {
  authenticateToken
};
