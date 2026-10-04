import 'package:steg_app/features/pointage/domain/pointage_repository.dart';
import 'package:steg_app/models/pointage.dart';

class FakePointageRepository implements PointageRepository {
  FakePointageRepository({
    List<Pointage>? presences,
    Horaire? horaire,
  })  : presences = presences ?? [],
        horaire = horaire ??
            const Horaire(
              heureDebut: '09:00',
              heureFin: '17:00',
              dureePauseMinutes: 60,
            );

  List<Pointage> presences;
  Horaire horaire;

  @override
  Future<Pointage> pointerEntree({required String stageId}) async {
    final pointage = Pointage.fromJson({
      'id': 'p-new',
      'stage_id': stageId,
      'date_pointage': _today(),
      'heure_entree': '09:00:00',
      'statut': 'PRESENT',
    });
    presences.add(pointage);
    return pointage;
  }

  @override
  Future<Pointage> pointerSortie({required String stageId}) async {
    final pointage = Pointage.fromJson({
      'id': 'p-sortie',
      'stage_id': stageId,
      'date_pointage': _today(),
      'heure_entree': '09:00:00',
      'heure_sortie': '17:00:00',
      'duree_minutes': 480,
      'statut': 'PRESENT',
    });
    presences.add(pointage);
    return pointage;
  }

  @override
  Future<List<Pointage>> getMesPresences() async => presences;

  @override
  Future<Horaire> getHoraires(String stageId) async => horaire;

  @override
  Future<PointageStats> getStats(String stageId) async =>
      const PointageStats(
        totalJours: 0,
        presents: 0,
        retards: 0,
        absents: 0,
        totalMinutes: 0,
        moyenneMinutes: 0,
        totalRetardMinutes: 0,
      );

  String _today() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}
