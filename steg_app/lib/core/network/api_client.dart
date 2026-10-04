import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../storage/token_storage.dart';
import 'api_interceptor.dart';

Dio buildDio({TokenStorageInterface? tokenStorage}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.connectTimeout,
      receiveTimeout: ApiConstants.receiveTimeout,
      contentType: ApiConstants.contentTypeJson,
      responseType: ResponseType.json,
    ),
  );
  dio.interceptors.add(AuthInterceptor(tokenStorage: tokenStorage));
  return dio;
}
