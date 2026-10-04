import '../../../../models/document_onboarding.dart';
import '../onboarding_repository.dart';

class GetOnboardingUseCase {
  GetOnboardingUseCase(this._repository);

  final OnboardingRepository _repository;

  Future<DocumentOnboarding?> call() {
    return _repository.getOnboarding();
  }
}
