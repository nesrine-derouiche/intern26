import '../../../models/candidature.dart';
import '../../../models/human_interview.dart';
import '../../../models/offre.dart';
import '../../../models/paginated_result.dart';

abstract interface class OffreRepository {
  Future<PaginatedResult<Offre>> listOffres({required int page, required int limit});

  Future<List<Candidature>> listMyCandidatures();

  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  });

  /// Entretien humain de la candidature (lecture seule pour le candidat).
  ///
  /// Retourne `null` si aucun entretien n'est planifié.
  Future<HumanInterview?> getHumanInterview(String candidatureId);
}
