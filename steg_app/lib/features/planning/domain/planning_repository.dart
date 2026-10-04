import '../../../models/planning.dart';

abstract interface class PlanningRepository {
  Future<Planning> getPlanning({
    String? stageId,
    String? dateDebut,
    String? dateFin,
    int page = 1,
    int limit = 100,
  });
}
