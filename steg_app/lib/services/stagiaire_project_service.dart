import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/stagiaire_project.dart';

class StagiaireProjectService {
  StagiaireProjectService(this._dio);

  final Dio _dio;

  Future<StagiaireProject> getProject() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.stagiaireProject,
      );
      final json = response.data ?? const {};
      return StagiaireProject.fromJson(json);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
