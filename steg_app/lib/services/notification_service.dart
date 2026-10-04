import 'dart:io';

import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/app_notification.dart';
import '../models/paginated_result.dart';
import '../core/utils/json_utils.dart';

class NotificationService {
  NotificationService(this._dio);

  final Dio _dio;

  Future<PaginatedResult<AppNotification>> list({
    int page = 1,
    int limit = 20,
    List<String>? types,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.notifications,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (types != null && types.isNotEmpty) 'type': types.join(','),
        },
      );
      final json = response.data ?? const {};
      final data = (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(AppNotification.fromJson)
          .toList();
      return PaginatedResult(
        data: data,
        total: numOrNull(json['total'])?.toInt() ?? data.length,
        page: numOrNull(json['page'])?.toInt() ?? 1,
        pages: numOrNull(json['pages'])?.toInt() ?? (data.isEmpty ? 0 : 1),
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<int> unreadCount() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiConstants.notificationsUnread);
      final json = response.data ?? const {};
      return numOrNull(json['total'])?.toInt() ?? 0;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      await _dio.put<dynamic>(ApiConstants.notificationLire(id));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _dio.put<dynamic>(ApiConstants.notificationsLireTout);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<dynamic>(ApiConstants.notificationDelete(id));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> registerDeviceToken(String token, {String? platform}) async {
    try {
      await _dio.post<dynamic>(
        ApiConstants.notificationDeviceToken,
        data: {
          'token': token,
          'platform': platform ?? _defaultPlatform,
        },
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> unregisterDeviceToken(String token) async {
    try {
      await _dio.delete<dynamic>(
        ApiConstants.notificationDeviceToken,
        data: {'token': token},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  static String get _defaultPlatform {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return 'web';
  }
}
