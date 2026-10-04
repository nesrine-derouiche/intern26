import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/personal_tache.dart';
import '../core/utils/json_utils.dart';

class PersonalTacheService {
  PersonalTacheService(this._dio);

  final Dio _dio;

  static const _basePath = '/personal-taches';

  Future<List<PersonalTache>> list() async {
    try {
      final response = await _dio.get<List<dynamic>>(_basePath);
      return (response.data ?? [])
          .whereType<Map<String, dynamic>>()
          .map(PersonalTache.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PersonalTache> create({
    required String titre,
    String? description,
    String? priorite,
    String? dateEcheance,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        _basePath,
        data: {
          'titre': titre,
          if (description != null) 'description': description,
          if (priorite != null) 'priorite': priorite,
          if (dateEcheance != null) 'date_echeance': dateEcheance,
        },
      );
      return PersonalTache.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PersonalTache> update(String id, {
    String? titre,
    String? description,
    String? priorite,
    String? dateEcheance,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '$_basePath/$id',
        data: {
          if (titre != null) 'titre': titre,
          if (description != null) 'description': description,
          if (priorite != null) 'priorite': priorite,
          if (dateEcheance != null) 'date_echeance': dateEcheance,
        },
      );
      return PersonalTache.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete('$_basePath/$id');
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<PersonalTache> move(String id, {
    required String statut,
    required int position,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '$_basePath/$id/move',
        data: {
          'statut': statut,
          'position': position,
        },
      );
      return PersonalTache.fromJson(response.data ?? {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, int>> counts() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('$_basePath/counts');
      final data = response.data ?? {};
      return {
        'A_FAIRE': numOrNull(data['A_FAIRE'])?.toInt() ?? 0,
        'EN_COURS': numOrNull(data['EN_COURS'])?.toInt() ?? 0,
        'TERMINEE': numOrNull(data['TERMINEE'])?.toInt() ?? 0,
      };
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
