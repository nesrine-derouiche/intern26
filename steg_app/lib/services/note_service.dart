import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/note.dart';

class NoteService {
  NoteService(this._dio);

  final Dio _dio;

  Future<List<Note>> list() async {
    try {
      final response = await _dio.get<List<dynamic>>(ApiConstants.notes);
      final data = response.data ?? const <dynamic>[];
      return data
          .whereType<Map<String, dynamic>>()
          .map(Note.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Note> create({
    required String titre,
    required String contenu,
    required String clientKey,
    bool pinned = false,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.notes,
        data: {
          'titre': titre,
          'contenu': contenu,
          'pinned': pinned,
          'client_key': clientKey,
        },
      );
      final json = response.data ?? const {};
      final note = json['note'];
      return Note.fromJson(note is Map<String, dynamic> ? note : {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Note> update(
    String id, {
    String? titre,
    String? contenu,
    bool? pinned,
  }) async {
    try {
      final data = <String, dynamic>{};
      if (titre != null) data['titre'] = titre;
      if (contenu != null) data['contenu'] = contenu;
      if (pinned != null) data['pinned'] = pinned;
      final response = await _dio.put<Map<String, dynamic>>(
        ApiConstants.noteById(id),
        data: data,
      );
      final json = response.data ?? const {};
      final note = json['note'];
      return Note.fromJson(note is Map<String, dynamic> ? note : {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> remove(String id) async {
    try {
      await _dio.delete<Map<String, dynamic>>(ApiConstants.noteById(id));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
