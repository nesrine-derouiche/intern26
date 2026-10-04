import '../../../../models/candidature.dart';
import '../offre_repository.dart';

class ApplyToOffreUseCase {
  ApplyToOffreUseCase(this._repository);

  final OffreRepository _repository;

  Future<Candidature> call({
    required String stagiaireId,
    required String offreId,
  }) {
    return _repository.applyToOffre(stagiaireId: stagiaireId, offreId: offreId);
  }
}
