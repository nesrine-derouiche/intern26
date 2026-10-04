import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/planning.dart';

class PlanningService {
  PlanningService(this._dio);

  final Dio _dio;

  Future<Planning> getPlanning({
    String? stageId,
    String? dateDebut,
    String? dateFin,
    int page = 1,
    int limit = 100,
  }) async {
    try {
      final queryParameters = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (stageId != null && stageId.isNotEmpty) {
        queryParameters['stage_id'] = stageId;
      }
      if (dateDebut != null && dateDebut.isNotEmpty) {
        queryParameters['date_debut'] = dateDebut;
      }
      if (dateFin != null && dateFin.isNotEmpty) {
        queryParameters['date_fin'] = dateFin;
      }

      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.planning,
        queryParameters: queryParameters,
      );
      final json = response.data ?? const <String, dynamic>{};
      return Planning.fromEnvelope(json);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
