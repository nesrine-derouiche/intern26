const express = require('express');
const router = express.Router();
const c = require('../controllers/notification.controller');
const { authenticateToken: auth } = require('../middlewares/auth.middleware');
const { validate } = require('../validators');
const {
  registerDeviceToken,
  unregisterDeviceToken,
} = require('../validators/notification.validator');

router.use(auth);
router.get('/', c.getAll);
router.get('/unread', c.getUnreadCount);
router.put('/lire-tout', c.markAllAsRead);
router.post('/device-token', registerDeviceToken, validate, c.registerDeviceToken);
router.delete('/device-token', unregisterDeviceToken, validate, c.unregisterDeviceToken);
router.put('/:id/lire', c.markAsRead);
router.delete('/:id', c.delete);
module.exports = router;
