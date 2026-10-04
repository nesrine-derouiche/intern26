const crypto = require('crypto');

/**
 * Configuration de l'accès à l'application mobile.
 *
 * - `MOBILE_APP_DOWNLOAD_URL` : lien de téléchargement de l'application mobile
 *   affiché dans l'email D-1. Optionnel : sans cette variable, la section
 *   « Télécharger l'application » est omise de l'email.
 * - `MOBILE_CREDENTIALS_ENCRYPTION_KEY` : clé de chiffrement (AES-256-GCM) du
 *   mot de passe temporaire persisté entre la préparation et l'envoi D-1.
 *   En l'absence de clé dédiée, on retombe sur `JWT_SECRET` (jamais de valeur
 *   codée en dur, jamais de stockage du mot de passe en clair).
 */

const DOWNLOAD_URL = process.env.MOBILE_APP_DOWNLOAD_URL || '';
const ENCRYPTION_KEY = process.env.MOBILE_CREDENTIALS_ENCRYPTION_KEY || process.env.JWT_SECRET || '';

/** Clé AES-256-GCM dérivée (32 octets déterministes) depuis les variables d'environnement. */
function encryptionKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error('Aucune clé de chiffrement des identifiants mobiles : définissez MOBILE_CREDENTIALS_ENCRYPTION_KEY (ou JWT_SECRET).');
  }
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

module.exports = {
  downloadUrl: DOWNLOAD_URL,
  encryptionKey
};
