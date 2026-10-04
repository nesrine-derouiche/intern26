import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/candidature.dart';
import '../models/human_interview.dart';

class CandidatureService {
  CandidatureService(this._dio);

  final Dio _dio;

  Future<List<Candidature>> listMyCandidatures({int page = 1, int limit = 100}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.candidatures,
        queryParameters: {'page': page, 'limit': limit},
      );
      final json = response.data ?? const {};
      return (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(Candidature.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Candidature> createApplication({
    required String stagiaireId,
    required String offreId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.candidatures,
        data: {'stagiaire_id': stagiaireId, 'offre_id': offreId},
      );
      final candidature =
          (response.data?['candidature'] as Map<String, dynamic>?) ?? const {};
      return Candidature.fromJson(candidature);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<HumanInterview?> getHumanInterview(String candidatureId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '${ApiConstants.candidatures}/$candidatureId/entretien-humain',
      );
      final json = response.data ?? const {};
      final interview = json['interview'];
      if (interview == null) return null;
      return HumanInterview.fromJson(interview as Map<String, dynamic>);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
