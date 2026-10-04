import '../../../../models/document_onboarding.dart';
import '../onboarding_repository.dart';

class UploadOnboardingDocumentUseCase {
  UploadOnboardingDocumentUseCase(this._repository);

  final OnboardingRepository _repository;

  Future<DocumentOnboarding> call({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  }) {
    return _repository.uploadDocument(
      candidatureId: candidatureId,
      type: type,
      filePath: filePath,
      fileName: fileName,
    );
  }
}
