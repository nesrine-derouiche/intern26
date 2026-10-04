const notificationRepository = require('../repositories/notification.repository');
const utilisateurRepository = require('../repositories/utilisateur.repository');
const pushService = require('./push.service');
const { buildPaginatedResult } = require('../utils/pagination.util');
const logger = require('../utils/logger');

class NotificationService {
  async getMyNotifications(userId, options = null) {
    const rows = await notificationRepository.findByUser(userId, options);
    if (options && options.enabled) return buildPaginatedResult(rows.data, rows.total, options.page, options.limit);
    return rows;
  }

  async markAsRead(id, userId) {
    await notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId) {
    await notificationRepository.markAllAsRead(userId);
  }

  async deleteNotification(id, userId) {
    await notificationRepository.delete(id, userId);
  }

  async getUnreadCount(userId) {
    return { total: await notificationRepository.countUnread(userId) };
  }

  async notifyBestEffort(userId, titre, message, type, lien = null) {
    try {
      await notificationRepository.create(userId, titre, message, type, lien);
      pushService
        .sendToUser(userId, { title: titre, body: message, data: { type: type || 'INFO', lien } })
        .catch((err) => logger.debug('Notification push non envoyée :', err.message));
    } catch (err) {
      logger.error('Échec de la création de la notification:', err);
    }
  }

  /** Notifie best effort tous les utilisateurs d'un rôle donné (une seule notification par utilisateur). */
  async notifyRoleBestEffort(role, titre, message, type, lien = null) {
    try {
      const userIds = await utilisateurRepository.findIdsByRole(role);
      const seen = new Set();
      for (const id of userIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        await this.notifyBestEffort(id, titre, message, type, lien);
      }
    } catch (err) {
      logger.error('Échec de la notification par rôle :', err);
    }
  }
}

module.exports = new NotificationService();
