import 'package:steg_app/core/storage/token_storage.dart';

/// In-memory fake for TokenStorage that avoids platform dependencies in tests.
class FakeTokenStorage implements TokenStorageInterface {
  String? token;
  String? refreshToken;

  @override
  Future<String?> readAccessToken() async => token;
  @override
  Future<String?> readRefreshToken() async => refreshToken;
  @override
  Future<void> writeAccessToken(String value) async => token = value;
  @override
  Future<void> writeRefreshToken(String value) async => refreshToken = value;
  @override
  Future<void> clear() async {
    token = null;
    refreshToken = null;
  }
}
