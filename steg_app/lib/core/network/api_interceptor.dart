import 'package:dio/dio.dart';

import '../auth/session_invalidator.dart';
import '../storage/token_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    TokenStorageInterface? tokenStorage,
    SessionInvalidator? sessionInvalidator,
  })  : _tokenStorage = tokenStorage ?? TokenStorage(),
        _sessionInvalidator = sessionInvalidator ?? SessionInvalidator.instance;

  final TokenStorageInterface _tokenStorage;
  final SessionInvalidator _sessionInvalidator;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenStorage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await _tokenStorage.clear();
      _sessionInvalidator.invalidate();
    }
    handler.next(err);
  }
}
