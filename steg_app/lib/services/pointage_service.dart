import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/pointage.dart';

class PointageService {
  PointageService(this._dio);

  final Dio _dio;

  Future<Pointage> pointerEntree({required String stageId}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${ApiConstants.pointages}/entree',
        data: {'stage_id': stageId},
      );
      final data = response.data ?? {};
      final pointage = data['pointage'];
      if (pointage is Map<String, dynamic>) return Pointage.fromJson(pointage);
      return Pointage.fromJson(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Pointage> pointerSortie({required String stageId}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${ApiConstants.pointages}/sortie',
        data: {'stage_id': stageId},
      );
      final data = response.data ?? {};
      final pointage = data['pointage'];
      if (pointage is Map<String, dynamic>) return Pointage.fromJson(pointage);
      return Pointage.fromJson(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<List<Pointage>> getMesPresences() async {
    try {
      final response = await _dio.get<dynamic>(
        '${ApiConstants.pointages}/mes-presences',
      );
      final data = response.data;
      List<dynamic> list;
      if (data is List) {
        list = data;
      } else if (data is Map<String, dynamic>) {
        list = data['data'] as List<dynamic>? ?? const <dynamic>[];
      } else {
        list = const <dynamic>[];
      }
      return list
          .whereType<Map<String, dynamic>>()
          .map(Pointage.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Horaire> getHoraires(String stageId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.pointageHoraires(stageId),
      );
      return Horaire.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PointageStats> getStats(String stageId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.pointageStats(stageId),
      );
      return PointageStats.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
