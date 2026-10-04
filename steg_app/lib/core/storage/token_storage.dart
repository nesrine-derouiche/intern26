import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/storage_keys.dart';

abstract interface class TokenStorageInterface {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> writeAccessToken(String token);
  Future<void> writeRefreshToken(String token);
  Future<void> clear();
}

class TokenStorage implements TokenStorageInterface {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() => _storage.read(key: StorageKeys.accessToken);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: StorageKeys.refreshToken);

  @override
  Future<void> writeAccessToken(String token) =>
      _storage.write(key: StorageKeys.accessToken, value: token);

  @override
  Future<void> writeRefreshToken(String token) =>
      _storage.write(key: StorageKeys.refreshToken, value: token);

  @override
  Future<void> clear() => _storage.deleteAll();
}
