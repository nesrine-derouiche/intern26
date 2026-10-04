const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { encryptionKey } = require('../config/mobile');

/**
 * Service de génération et de protection des identifiants mobiles.
 *
 * Sécurité :
 *  - mot de passe temporaire aléatoire (>= 8 caractères, majuscule + minuscule
 *    + chiffre + symbole) généré via `crypto.randomInt` — jamais dérivé du nom,
 *    de l'email ou d'une date de naissance ;
 *  - seul le hash bcrypt est stocké sur le compte utilisateur (mot_de_passe) ;
 *  - entre la préparation et l'envoi de l'email D-1, le mot de passe temporaire
 *    doit être réutilisable par le job (retries) : il est donc persisté de façon
 *    CHIFFRÉE (AES-256-GCM), jamais en clair, et purgé après envoi réussi.
 */

const BCRYPT_ROUNDS = 12;
const PASSWORD_LENGTH = 14;

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%*+=?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

class MobileCredentialsService {
  /**
   * Génère un mot de passe temporaire fort : au moins un caractère de chaque
   * classe requise, le reste aléatoire, puis mélange (Fisher-Yates) avec
   * `crypto.randomInt`. Aucune classe n'est donc devinable par position.
   */
  generateTemporaryPassword(length = PASSWORD_LENGTH) {
    const chars = [UPPER, LOWER, DIGITS, SYMBOLS].map((group) => group[crypto.randomInt(group.length)]);
    while (chars.length < length) {
      chars.push(ALL[crypto.randomInt(ALL.length)]);
    }
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  /** Hash bcrypt d'un mot de passe (stocké sur le compte utilisateur). */
  async hashPassword(plain) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  /** Chiffre un secret (mot de passe temporaire) : IV + payload + tag, en base64. */
  encryptSecret(plain) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), encrypted.toString('base64'), tag.toString('base64')].join('.');
  }

  /** Déchiffre un secret chiffré par `encryptSecret` (échec → exception). */
  decryptSecret(payload) {
    const [ivB64, dataB64, tagB64] = String(payload).split('.');
    if (!ivB64 || !dataB64 || !tagB64) {
      throw new Error('Payload chiffré invalide.');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }
}

module.exports = new MobileCredentialsService();
