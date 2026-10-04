import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/document_item.dart';
import '../models/paginated_result.dart';
import '../core/utils/json_utils.dart';

class DocumentService {
  DocumentService(this._dio);

  final Dio _dio;

  Future<PaginatedResult<DocumentItem>> listByStage({
    required String stageId,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.documentsOfStage(stageId),
        queryParameters: {'page': page, 'limit': limit},
      );
      final json = response.data ?? const {};
      final data = (json['data'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(DocumentItem.fromJson)
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

  Future<DocumentItem> upload({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    try {
      final form = FormData.fromMap({
        'type': type,
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.documentsOfStage(stageId),
        data: form,
      );
      final document = response.data?['document'];
      return DocumentItem.fromJson(document is Map<String, dynamic> ? document : {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Uint8List> downloadBytes(String id, {bool preview = false}) async {
    try {
      final endpoint = preview
          ? ApiConstants.documentPreview(id)
          : ApiConstants.documentDownload(id);
      final response = await _dio.get<List<int>>(
        endpoint,
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(response.data ?? const <int>[]);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Uint8List> downloadStagePdf({
    required String stageId,
    required String kind,
  }) async {
    try {
      final response = await _dio.get<List<int>>(
        ApiConstants.stagePdf(stageId, kind),
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(response.data ?? const <int>[]);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> delete(String id) async {
    try {
      await _dio.delete<Map<String, dynamic>>(ApiConstants.documentDelete(id));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  List<DocumentItem> generatedDocumentsForStage({
    required String stageId,
    DateTime? generatedAt,
  }) {
    final date = generatedAt ?? DateTime.now();
    return [
      DocumentItem(
        id: 'generated-convention',
        stageId: stageId,
        type: 'CONVENTION',
        nom: 'convention_stage.pdf',
        chemin: '',
        dateDepot: date,
      ),
      DocumentItem(
        id: 'generated-attestation',
        stageId: stageId,
        type: 'ATTESTATION',
        nom: 'attestation_stage.pdf',
        chemin: '',
        dateDepot: date,
      ),
      DocumentItem(
        id: 'generated-evaluation',
        stageId: stageId,
        type: 'EVALUATION',
        nom: 'evaluation_stage.pdf',
        chemin: '',
        dateDepot: date,
      ),
    ];
  }
}
