import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/stagiaire_overview.dart';

class StagiaireOverviewService {
  StagiaireOverviewService(this._dio);

  final Dio _dio;

  Future<StagiaireOverview> getOverview() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>(ApiConstants.stagiaireOverview);
      return StagiaireOverview.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
