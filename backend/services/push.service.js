const logger = require('../utils/logger');
const deviceTokenRepository = require('../repositories/device_token.repository');

class PushService {
  _admin = null;
  _checked = false;

  _firebaseAdmin() {
    if (this._checked) return this._admin;
    this._checked = true;
    try {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        logger.info('FCM désactivé : GOOGLE_APPLICATION_CREDENTIALS non défini.');
        return null;
      }
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
      this._admin = admin;
      logger.info('Firebase Cloud Messaging initialisé.');
    } catch (err) {
      logger.warn('FCM indisponible :', err.message);
    }
    return this._admin;
  }

  /**
   * Envoie une notification push à tous les appareils d'un utilisateur.
   * Retourne toujours sans lever d'exception (best-effort).
   */
  async sendToUser(userId, { title, body, data = {} }) {
    const admin = this._firebaseAdmin();
    if (!admin) return false;

    let tokens;
    try {
      tokens = await deviceTokenRepository.findTokensByUser(userId);
    } catch (err) {
      logger.error('Erreur lors de la récupération des jetons push :', err.message);
      return false;
    }
    if (!tokens.length) return false;

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          ...data,
          type: data.type || 'INFO',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
      });

      response.responses.forEach(async (result, index) => {
        if (!result.success && tokens[index]) {
          await deviceTokenRepository.deleteToken(tokens[index]);
        }
      });
      return true;
    } catch (err) {
      logger.error('Échec de l\'envoi push :', err.message);
      return false;
    }
  }
}

module.exports = new PushService();
