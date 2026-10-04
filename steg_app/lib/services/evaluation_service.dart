import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/evaluation.dart';
import '../models/paginated_result.dart';
import '../core/utils/json_utils.dart';

class EvaluationService {
  EvaluationService(this._dio);

  final Dio _dio;

  Future<PaginatedResult<Evaluation>> list({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.evaluations,
        queryParameters: {'page': page, 'limit': limit},
      );
      final json = response.data ?? const {};
      final data = (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(Evaluation.fromJson)
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
}
