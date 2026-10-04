import '../../../../models/planning.dart';
import '../planning_repository.dart';

class GetPlanningUseCase {
  GetPlanningUseCase(this._repository);

  final PlanningRepository _repository;

  Future<Planning> call({
    String? stageId,
    String? dateDebut,
    String? dateFin,
    int page = 1,
    int limit = 100,
  }) =>
      _repository.getPlanning(
        stageId: stageId,
        dateDebut: dateDebut,
        dateFin: dateFin,
        page: page,
        limit: limit,
      );
}
