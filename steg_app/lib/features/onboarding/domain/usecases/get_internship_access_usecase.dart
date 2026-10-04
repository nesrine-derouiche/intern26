import '../../../../models/internship_access.dart';
import '../onboarding_repository.dart';

class GetInternshipAccessUseCase {
  GetInternshipAccessUseCase(this._repository);

  final OnboardingRepository _repository;

  Future<InternshipAccess> call(String candidatureId) {
    return _repository.getInternshipAccess(candidatureId);
  }
}
