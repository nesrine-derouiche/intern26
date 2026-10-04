import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';

void main() {
  group('ApiException.fromDio', () {
    test('extracts backend message for error responses', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/auth/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/auth/login'),
          statusCode: 401,
          data: {'success': false, 'message': 'Email ou mot de passe incorrect.'},
        ),
      );

      final exception = ApiException.fromDio(error);

      expect(exception.statusCode, 401);
      expect(exception.message, 'Email ou mot de passe incorrect.');
      expect(exception.isUnauthorized, isTrue);
    });

    test('maps connection timeouts to a friendly message', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionTimeout,
      );

      final exception = ApiException.fromDio(error);

      expect(exception.statusCode, isNull);
      expect(exception.isNetworkError, isTrue);
      expect(exception.message, contains('Délai'));
    });

    test('maps connection errors to a friendly message', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError,
      );

      final exception = ApiException.fromDio(error);

      expect(exception.statusCode, isNull);
      expect(exception.message, contains('serveur'));
    });

    test('falls back to a generic message for unknown errors', () {
      final error = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 500,
          data: {},
        ),
      );

      final exception = ApiException.fromDio(error);

      expect(exception.statusCode, 500);
      expect(exception.message, contains('erreur'));
    });
  });
}
