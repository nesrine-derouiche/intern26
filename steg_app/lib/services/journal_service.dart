import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/journal_entry.dart';
import '../models/paginated_result.dart';
import '../core/utils/json_utils.dart';

class JournalService {
  JournalService(this._dio);

  final Dio _dio;

  Future<PaginatedResult<JournalEntry>> list({
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.journals,
        queryParameters: {'page': page, 'limit': limit},
      );
      final json = response.data ?? const {};
      final data = (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(JournalEntry.fromJson)
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

  Future<JournalEntry> create(JournalDraft draft) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.journals,
        data: draft.toJson(),
      );
      return _journalFrom(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<JournalEntry> update({
    required String id,
    required JournalDraft draft,
  }) async {
    try {
      final response = await _dio.put<Map<String, dynamic>>(
        '${ApiConstants.journals}/$id',
        data: draft.toJson(),
      );
      return _journalFrom(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<JournalEntry> submit(String id) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${ApiConstants.journals}/$id/soumettre',
      );
      return _journalFrom(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<JournalEntry> validate(String id, {String commentaire = ''}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${ApiConstants.journals}/$id/valider',
        data: {'commentaire_encadrant': commentaire},
      );
      return _journalFrom(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<JournalEntry> reject(String id, {String commentaire = ''}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${ApiConstants.journals}/$id/rejeter',
        data: {'commentaire_encadrant': commentaire},
      );
      return _journalFrom(response.data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  JournalEntry _journalFrom(Map<String, dynamic>? json) {
    final journal = json?['journal'];
    if (journal is Map<String, dynamic>) return JournalEntry.fromJson(journal);
    return JournalEntry.fromJson(json ?? const {});
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<Map<String, dynamic>>('${ApiConstants.journals}/$id');
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
