import '../../../models/document_onboarding.dart';
import '../../../models/internship_access.dart';
import '../../../services/document_onboarding_service.dart';
import '../domain/onboarding_repository.dart';

class OnboardingRepositoryImpl implements OnboardingRepository {
  OnboardingRepositoryImpl({required DocumentOnboardingService service})
      : _service = service;

  final DocumentOnboardingService _service;

  @override
  Future<DocumentOnboarding?> getOnboarding() {
    return _service.fetchOnboarding();
  }

  @override
  Future<DocumentOnboarding> uploadDocument({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  }) {
    return _service.upload(
      candidatureId: candidatureId,
      type: type,
      filePath: filePath,
      fileName: fileName,
    );
  }

  @override
  Future<InternshipAccess> getInternshipAccess(String candidatureId) {
    return _service.fetchInternshipAccess(candidatureId);
  }
}
