import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/pointage/data/pointage_repository_impl.dart';
import '../../features/pointage/domain/pointage_repository.dart';
import '../../models/pointage.dart';
import '../core/api_client_provider.dart';
import '../dashboard/dashboard_providers.dart';
import '../../services/pointage_service.dart';

final pointageServiceProvider = Provider<PointageService>(
  (ref) => PointageService(ref.watch(dioProvider)),
);

final pointageRepositoryProvider = Provider<PointageRepository>(
  (ref) => PointageRepositoryImpl(
    pointageService: ref.watch(pointageServiceProvider),
  ),
);

final pointageProvider =
    AsyncNotifierProvider<PointageNotifier, PointageState>(
  PointageNotifier.new,
);

class PointageState {
  const PointageState({
    required this.todayPointage,
    required this.horaire,
    this.isLoadingAction = false,
  });

  final Pointage? todayPointage;
  final Horaire horaire;
  final bool isLoadingAction;

  PointageState copyWith({
    Pointage? todayPointage,
    Horaire? horaire,
    bool? isLoadingAction,
  }) {
    return PointageState(
      todayPointage: todayPointage ?? this.todayPointage,
      horaire: horaire ?? this.horaire,
      isLoadingAction: isLoadingAction ?? this.isLoadingAction,
    );
  }

  bool get hasEntry => todayPointage?.hasEntry ?? false;
  bool get hasExit => todayPointage?.hasExit ?? false;
  bool get isJourneeTerminee => hasEntry && hasExit;
}

class PointageNotifier extends AsyncNotifier<PointageState> {
  @override
  Future<PointageState> build() async {
    final repo = ref.read(pointageRepositoryProvider);
    final statsAsync = ref.watch(dashboardStatsProvider);
    final stageId = statsAsync.value?.internship?.id;

    final horaireFuture = stageId != null
        ? repo.getHoraires(stageId)
        : Future.value(const Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60));

    final presencesFuture = repo.getMesPresences();

    final results = await Future.wait([horaireFuture, presencesFuture]);
    final horaire = results[0] as Horaire;
    final presences = results[1] as List<Pointage>;

    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final todayPointage = presences.where((p) {
      final dp = p.datePointage;
      if (dp == null) return false;
      final dpStr =
          '${dp.year}-${dp.month.toString().padLeft(2, '0')}-${dp.day.toString().padLeft(2, '0')}';
      return dpStr == todayStr;
    }).fold<Pointage?>(
      null,
      (prev, e) => e,
    );

    return PointageState(
      todayPointage: todayPointage,
      horaire: horaire,
    );
  }

  String? _getStageId() {
    final statsAsync = ref.read(dashboardStatsProvider);
    return statsAsync.value?.internship?.id;
  }

  Future<void> pointerEntree() async {
    final stageId = _getStageId();
    if (stageId == null) throw StateError('Aucun stage actif.');

    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(pointageRepositoryProvider);
      final pointage = await repo.pointerEntree(stageId: stageId);
      final current = state.value ?? const PointageState(todayPointage: null, horaire: Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60));
      return current.copyWith(todayPointage: pointage);
    });
  }

  Future<void> pointerSortie() async {
    final stageId = _getStageId();
    if (stageId == null) throw StateError('Aucun stage actif.');

    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(pointageRepositoryProvider);
      final pointage = await repo.pointerSortie(stageId: stageId);
      final current = state.value ?? const PointageState(todayPointage: null, horaire: Horaire(heureDebut: '09:00', heureFin: '17:00', dureePauseMinutes: 60));
      return current.copyWith(todayPointage: pointage);
    });
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(build);
  }
}

final mesPresencesProvider =
    AsyncNotifierProvider<MesPresencesNotifier, List<Pointage>>(
  MesPresencesNotifier.new,
);

class MesPresencesNotifier extends AsyncNotifier<List<Pointage>> {
  @override
  Future<List<Pointage>> build() async {
    final repo = ref.read(pointageRepositoryProvider);
    return repo.getMesPresences();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(build);
  }
}
