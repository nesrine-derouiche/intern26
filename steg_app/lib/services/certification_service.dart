import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/certification.dart';

class CertificationService {
  CertificationService(this._dio);

  final Dio _dio;

  Future<CertificationState> getState({required String stageId}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.certification(stageId),
      );
      return CertificationState.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CertificationDocument> uploadDocument({
    required String stageId,
    required String kind,
    required String filePath,
    required String fileName,
  }) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          filePath,
          filename: fileName,
        ),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.certificationDocument(stageId, kind),
        data: form,
      );
      final json = response.data ?? const {};
      final document = json['document'];
      return CertificationDocument.fromJson(
        document is Map<String, dynamic> ? document : {},
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<CertificationState> submit({required String stageId}) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        ApiConstants.certificationSubmit(stageId),
      );
      return getState(stageId: stageId);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<Uint8List> downloadAttestation({required String stageId}) async {
    try {
      final response = await _dio.get<List<int>>(
        ApiConstants.certificationAttestation(stageId),
        options: Options(responseType: ResponseType.bytes),
      );
      final data = response.data;
      if (data == null || data.isEmpty) {
        throw const ApiException(404, 'Attestation indisponible.');
      }
      return Uint8List.fromList(data);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
