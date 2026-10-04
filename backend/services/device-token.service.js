const deviceTokenRepository = require('../repositories/device_token.repository');

class DeviceTokenService {
  async register(userId, token, platform = 'android') {
    await deviceTokenRepository.upsert(userId, token, platform);
  }

  async unregister(userId, token) {
    await deviceTokenRepository.deleteByUserAndToken(userId, token);
  }
}

module.exports = new DeviceTokenService();
