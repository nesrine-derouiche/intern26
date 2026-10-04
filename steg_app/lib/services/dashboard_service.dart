import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/dashboard_stats.dart';

class DashboardService {
  DashboardService(this._dio);

  final Dio _dio;

  Future<DashboardStats> getStats() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiConstants.dashboardStats);
      return DashboardStats.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
