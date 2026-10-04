import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/pointage/domain/pointage_repository.dart';
import 'package:steg_app/models/pointage.dart';
import 'package:steg_app/providers/pointage/pointage_providers.dart';

class FakePointageRepository implements PointageRepository {
  FakePointageRepository({
    List<Pointage>? presences,
    Horaire? horaire,
    PointageStats? stats,
  })  : presences = presences ?? [],
        horaire = horaire ??
            const Horaire(
              heureDebut: '09:00',
              heureFin: '17:00',
              dureePauseMinutes: 60,
            ),
        stats = stats ??
            const PointageStats(
              totalJours: 0,
              presents: 0,
              retards: 0,
              absents: 0,
              totalMinutes: 0,
              moyenneMinutes: 0,
              totalRetardMinutes: 0,
            );

  List<Pointage> presences;
  Horaire horaire;
  PointageStats stats;

  int entreeCount = 0;
  int sortieCount = 0;

  @override
  Future<Pointage> pointerEntree({required String stageId}) async {
    entreeCount++;
    final pointage = Pointage.fromJson({
      'id': 'p-entree-$entreeCount',
      'stage_id': stageId,
      'date_pointage': _todayStr(),
      'heure_entree': '09:00:00',
      'statut': 'PRESENT',
    });
    presences.add(pointage);
    return pointage;
  }

  @override
  Future<Pointage> pointerSortie({required String stageId}) async {
    sortieCount++;
    final pointage = Pointage.fromJson({
      'id': 'p-sortie-$sortieCount',
      'stage_id': stageId,
      'date_pointage': _todayStr(),
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
  Future<PointageStats> getStats(String stageId) async => stats;

  String _todayStr() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

Pointage pointage(Map<String, dynamic> json) => Pointage.fromJson(json);

void main() {
  group('mesPresencesProvider', () {
    test('loads presences from repository', () async {
      final repository = FakePointageRepository(presences: [
        pointage({'id': 'p1', 'date_pointage': '2026-01-15', 'statut': 'PRESENT'}),
        pointage({'id': 'p2', 'date_pointage': '2026-01-16', 'statut': 'RETARD', 'retard_minutes': 10}),
        pointage({'id': 'p3', 'date_pointage': '2026-01-17', 'statut': 'ABSENT'}),
      ]);
      final container = ProviderContainer(
        overrides: [pointageRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final presences = await container.read(mesPresencesProvider.future);
      expect(presences, hasLength(3));
      expect(presences.first.id, 'p1');
      expect(presences.first.statut, PointageStatut.present);
    });

    test('returns empty list when no presences', () async {
      final repository = FakePointageRepository();
      final container = ProviderContainer(
        overrides: [pointageRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final presences = await container.read(mesPresencesProvider.future);
      expect(presences, isEmpty);
    });

    test('refresh reloads data', () async {
      final repository = FakePointageRepository();
      final container = ProviderContainer(
        overrides: [pointageRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(mesPresencesProvider.future);
      repository.presences.add(
        pointage({'id': 'new', 'date_pointage': '2026-01-20'}),
      );
      await container.read(mesPresencesProvider.notifier).refresh();

      final presences = container.read(mesPresencesProvider).value!;
      expect(presences, hasLength(1));
      expect(presences.first.id, 'new');
    });
  });

  group('PointageState', () {
    test('hasEntry is false when no pointage', () {
      const state = PointageState(
        todayPointage: null,
        horaire: Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60),
      );
      expect(state.hasEntry, isFalse);
      expect(state.hasExit, isFalse);
      expect(state.isJourneeTerminee, isFalse);
    });

    test('hasEntry is true when entry exists', () {
      final state = PointageState(
        todayPointage: pointage({'id': 'p1', 'heure_entree': '09:00:00'}),
        horaire: const Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60),
      );
      expect(state.hasEntry, isTrue);
      expect(state.hasExit, isFalse);
      expect(state.isJourneeTerminee, isFalse);
    });

    test('isJourneeTerminee when both entry and exit exist', () {
      final state = PointageState(
        todayPointage: pointage({
          'id': 'p1',
          'heure_entree': '09:00:00',
          'heure_sortie': '17:00:00',
        }),
        horaire: const Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60),
      );
      expect(state.isJourneeTerminee, isTrue);
    });

    test('copyWith preserves fields', () {
      final original = PointageState(
        todayPointage: pointage({'id': 'p1'}),
        horaire: const Horaire(heureDebut: '08:00', heureFin: '16:00', dureePauseMinutes: 30),
      );
      final copy = original.copyWith(isLoadingAction: true);

      expect(copy.todayPointage?.id, 'p1');
      expect(copy.horaire.heureDebut, '08:00');
      expect(copy.isLoadingAction, isTrue);
    });

    test('copyWith with null todayPointage keeps original', () {
      final original = PointageState(
        todayPointage: pointage({'id': 'p1'}),
        horaire: const Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60),
      );
      final copy = original.copyWith();

      expect(copy.todayPointage?.id, 'p1');
    });
  });

  group('pointageServiceProvider', () {
    test('creates a PointageService instance', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(pointageServiceProvider), isNotNull);
    });
  });
}
