const { asyncHandler } = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');
const deviceTokenService = require('../services/device-token.service');
const { sendResponse } = require('../utils/response.util');
const { getPaginationParams } = require('../utils/pagination.util');

const getAll = asyncHandler(async (req, res) => {
  const options = getPaginationParams(req.query);
  const types = req.query.type
    ? String(req.query.type).split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  if (types.length) options.types = types;
  sendResponse(res, 200, await notificationService.getMyNotifications(req.user.id, options));
});

const getUnreadCount = asyncHandler(async (req, res) => {
  sendResponse(res, 200, await notificationService.getUnreadCount(req.user.id));
});

const markAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAsRead(req.params.id, req.user.id);
  sendResponse(res, 200, null, 'Notification marquée comme lue.');
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  sendResponse(res, 200, null, 'Toutes les notifications ont été marquées comme lues.');
});

const delete_ = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user.id);
  sendResponse(res, 200, null, 'Notification supprimée.');
});

const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  await deviceTokenService.register(req.user.id, token, platform || 'android');
  sendResponse(res, 200, null, 'Jeton de notification enregistré.');
});

const unregisterDeviceToken = asyncHandler(async (req, res) => {
  await deviceTokenService.unregister(req.user.id, req.body.token);
  sendResponse(res, 200, null, 'Jeton de notification supprimé.');
});

module.exports = {
  getAll,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  delete: delete_,
  registerDeviceToken,
  unregisterDeviceToken,
};
