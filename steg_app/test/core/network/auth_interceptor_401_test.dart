import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/auth/session_invalidator.dart';
import 'package:steg_app/core/network/api_interceptor.dart';

import '../../helpers/fake_token_storage.dart';

void main() {
  group('AuthInterceptor', () {
    late FakeTokenStorage tokenStorage;
    late SessionInvalidator invalidator;

    setUp(() {
      tokenStorage = FakeTokenStorage();
      invalidator = SessionInvalidator.instance;
    });

    AuthInterceptor buildInterceptor() => AuthInterceptor(
          tokenStorage: tokenStorage,
          sessionInvalidator: invalidator,
        );

    test('injects Authorization header when token exists', () async {
      tokenStorage.token = 'my-jwt';

      final interceptor = buildInterceptor();

      // Verify onRequest injects header by calling it directly
      final options = RequestOptions(path: '/test');
      await interceptor.onRequest(options, _FakeRequestHandler());

      expect(options.headers['Authorization'], 'Bearer my-jwt');
    });

    test('clears token and fires invalidation on 401', () async {
      tokenStorage.token = 'expired-jwt';

      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      final dioException = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 401,
        ),
      );

      final interceptor = buildInterceptor();
      // Call onError directly — it calls handler.next internally
      await interceptor.onError(dioException, _FakeErrorForwardHandler());

      expect(tokenStorage.token, isNull);
      await Future<void>.delayed(Duration.zero);
      expect(events, hasLength(1));
      await sub.cancel();
    });

    test('does NOT clear token or fire invalidation on 403', () async {
      tokenStorage.token = 'valid-jwt';

      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      final dioException = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 403,
        ),
      );

      final interceptor = buildInterceptor();
      await interceptor.onError(dioException, _FakeErrorForwardHandler());

      expect(tokenStorage.token, 'valid-jwt');
      await Future<void>.delayed(Duration.zero);
      expect(events, isEmpty);
      await sub.cancel();
    });

    test('does NOT clear token or fire invalidation on 500', () async {
      tokenStorage.token = 'valid-jwt';

      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      final dioException = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 500,
        ),
      );

      final interceptor = buildInterceptor();
      await interceptor.onError(dioException, _FakeErrorForwardHandler());

      expect(tokenStorage.token, 'valid-jwt');
      await Future<void>.delayed(Duration.zero);
      expect(events, isEmpty);
      await sub.cancel();
    });

    test('does NOT clear token on network error (no response)', () async {
      tokenStorage.token = 'valid-jwt';

      final events = <void>[];
      final sub = invalidator.onInvalidated.listen(events.add);

      final dioException = DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.connectionError,
      );

      final interceptor = buildInterceptor();
      await interceptor.onError(dioException, _FakeErrorForwardHandler());

      expect(tokenStorage.token, 'valid-jwt');
      await Future<void>.delayed(Duration.zero);
      expect(events, isEmpty);
      await sub.cancel();
    });

    test('does NOT clear token on 422', () async {
      tokenStorage.token = 'valid-jwt';

      final dioException = DioException(
        requestOptions: RequestOptions(path: '/test'),
        response: Response(
          requestOptions: RequestOptions(path: '/test'),
          statusCode: 422,
        ),
      );

      final interceptor = buildInterceptor();
      await interceptor.onError(dioException, _FakeErrorForwardHandler());

      expect(tokenStorage.token, 'valid-jwt');
    });
  });
}

/// Minimal handler that forwards the error without crashing.
class _FakeErrorForwardHandler extends ErrorInterceptorHandler {
  @override
  void next(DioException err) {}
}

/// Minimal handler that forwards the request without crashing.
class _FakeRequestHandler extends RequestInterceptorHandler {
  @override
  void next(RequestOptions options) {}
}
