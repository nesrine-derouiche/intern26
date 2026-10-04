import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/stagiaire_profile.dart';

class StagiaireService {
  StagiaireService(this._dio);

  final Dio _dio;

  Future<StagiaireProfile> getProfile(String id) async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiConstants.stagiaire(id));
      return StagiaireProfile.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
