import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/supervisor_info.dart';

class EncadrantService {
  EncadrantService(this._dio);

  final Dio _dio;

  Future<List<SupervisorInfo>> list() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.encadrants,
        queryParameters: {'page': 1, 'limit': 100},
      );
      final json = response.data ?? const {};
      return (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(SupervisorInfo.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
