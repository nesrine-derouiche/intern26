import '../../../models/pointage.dart';
import '../../../services/pointage_service.dart';
import '../domain/pointage_repository.dart';

class PointageRepositoryImpl implements PointageRepository {
  PointageRepositoryImpl({required PointageService pointageService})
      : _pointageService = pointageService;

  final PointageService _pointageService;

  @override
  Future<Pointage> pointerEntree({required String stageId}) {
    return _pointageService.pointerEntree(stageId: stageId);
  }

  @override
  Future<Pointage> pointerSortie({required String stageId}) {
    return _pointageService.pointerSortie(stageId: stageId);
  }

  @override
  Future<List<Pointage>> getMesPresences() {
    return _pointageService.getMesPresences();
  }

  @override
  Future<Horaire> getHoraires(String stageId) {
    return _pointageService.getHoraires(stageId);
  }

  @override
  Future<PointageStats> getStats(String stageId) {
    return _pointageService.getStats(stageId);
  }
}
