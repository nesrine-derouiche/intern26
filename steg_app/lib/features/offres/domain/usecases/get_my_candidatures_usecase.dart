import '../../../../models/candidature.dart';
import '../offre_repository.dart';

class GetMyCandidaturesUseCase {
  GetMyCandidaturesUseCase(this._repository);

  final OffreRepository _repository;

  Future<List<Candidature>> call() {
    return _repository.listMyCandidatures();
  }
}
