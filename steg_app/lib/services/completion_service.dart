import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/completion_data.dart';

class CompletionService {
  CompletionService(this._dio);

  final Dio _dio;

  Future<CompletionData> getCompletionData() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.stagiaireCompletion,
      );
      final json = response.data ?? const {};
      return CompletionData.fromJson(json);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
