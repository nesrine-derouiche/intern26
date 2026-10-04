import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/document_onboarding.dart';
import '../models/internship_access.dart';

class DocumentOnboardingService {
  DocumentOnboardingService(this._dio);

  final Dio _dio;

  /// État du dossier de candidature du candidat connecté.
  ///
  /// Retourne `null` lorsque le candidat n'est pas dans la fenêtre
  /// d'onboarding (aucune candidature acceptée avec période validée) :
  /// l'accès à l'application reste alors ouvert.
  Future<DocumentOnboarding?> fetchOnboarding() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.myCandidatures,
      );
      final json = response.data ?? const {};
      final candidatures =
          (json['candidatures'] as List<dynamic>? ?? const <dynamic>[])
              .whereType<Map<String, dynamic>>();
      for (final candidature in candidatures) {
        final documents = candidature['documents_onboarding'];
        if (documents is Map<String, dynamic>) {
          return DocumentOnboarding.fromJson(documents);
        }
      }
      return null;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  /// Dépose un document du dossier (CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION).
  Future<DocumentOnboarding> upload({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        ApiConstants.onboardingDocument(candidatureId, type),
        data: form,
      );
      final json = response.data ?? const {};
      final documents = json['documents_onboarding'];
      if (documents is! Map<String, dynamic>) {
        throw ApiException(null, 'Réponse inattendue du serveur.');
      }
      return DocumentOnboarding.fromJson(documents);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  /// Verdict d'accès au stage après vérification du dossier du candidat.
  Future<InternshipAccess> fetchInternshipAccess(String candidatureId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        ApiConstants.internshipAccess(candidatureId),
      );
      return InternshipAccess.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
