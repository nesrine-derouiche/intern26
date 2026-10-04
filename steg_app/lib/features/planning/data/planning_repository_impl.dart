import '../../../models/planning.dart';
import '../../../services/planning_service.dart';
import '../domain/planning_repository.dart';

class PlanningRepositoryImpl implements PlanningRepository {
  PlanningRepositoryImpl(this._service);

  final PlanningService _service;

  @override
  Future<Planning> getPlanning({
    String? stageId,
    String? dateDebut,
    String? dateFin,
    int page = 1,
    int limit = 100,
  }) =>
      _service.getPlanning(
        stageId: stageId,
        dateDebut: dateDebut,
        dateFin: dateFin,
        page: page,
        limit: limit,
      );
}
