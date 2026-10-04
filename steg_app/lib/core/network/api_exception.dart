import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.statusCode, this.message);

  final int? statusCode;
  final String message;

  bool get isUnauthorized => statusCode == 401;
  bool get isNetworkError => statusCode == null;

  factory ApiException.fromDio(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) {
        return ApiException(error.response?.statusCode, message);
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(null, 'Délai de connexion dépassé. Veuillez réessayer.');
      case DioExceptionType.connectionError:
        return const ApiException(null, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
      default:
        return ApiException(
          error.response?.statusCode,
          'Une erreur est survenue. Veuillez réessayer.',
        );
    }
  }

  @override
  String toString() => message;
}
