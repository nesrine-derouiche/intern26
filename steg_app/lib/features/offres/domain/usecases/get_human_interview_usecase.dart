import '../../../../models/human_interview.dart';
import '../offre_repository.dart';

class GetHumanInterviewUseCase {
  GetHumanInterviewUseCase(this._repository);

  final OffreRepository _repository;

  Future<HumanInterview?> call(String candidatureId) {
    return _repository.getHumanInterview(candidatureId);
  }
}
