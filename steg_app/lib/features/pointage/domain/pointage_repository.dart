import '../../../models/pointage.dart';

abstract interface class PointageRepository {
  Future<Pointage> pointerEntree({required String stageId});
  Future<Pointage> pointerSortie({required String stageId});
  Future<List<Pointage>> getMesPresences();
  Future<Horaire> getHoraires(String stageId);
  Future<PointageStats> getStats(String stageId);
}
