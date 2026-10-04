import '../../../models/candidature.dart';
import '../../../models/human_interview.dart';
import '../../../models/offre.dart';
import '../../../models/paginated_result.dart';
import '../../../services/candidature_service.dart';
import '../../../services/offre_service.dart';
import '../domain/offre_repository.dart';

class OffreRepositoryImpl implements OffreRepository {
  OffreRepositoryImpl({
    required OffreService offreService,
    required CandidatureService candidatureService,
  })  : _offreService = offreService,
        _candidatureService = candidatureService;

  final OffreService _offreService;
  final CandidatureService _candidatureService;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) {
    return _offreService.list(page: page, limit: limit);
  }

  @override
  Future<List<Candidature>> listMyCandidatures() {
    return _candidatureService.listMyCandidatures();
  }

  @override
  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  }) {
    return _candidatureService.createApplication(
      stagiaireId: stagiaireId,
      offreId: offreId,
    );
  }

  @override
  Future<HumanInterview?> getHumanInterview(String candidatureId) {
    return _candidatureService.getHumanInterview(candidatureId);
  }
}
