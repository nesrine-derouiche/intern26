import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/planning/data/planning_repository_impl.dart';
import '../../features/planning/domain/planning_repository.dart';
import '../../features/planning/domain/usecases/get_planning_usecase.dart';
import '../../models/planning.dart';
import '../../services/planning_service.dart';
import '../core/api_client_provider.dart';

final planningServiceProvider = Provider<PlanningService>(
  (ref) => PlanningService(ref.watch(dioProvider)),
);

final planningRepositoryProvider = Provider<PlanningRepository>(
  (ref) => PlanningRepositoryImpl(ref.watch(planningServiceProvider)),
);

final getPlanningUseCaseProvider = Provider<GetPlanningUseCase>(
  (ref) => GetPlanningUseCase(ref.watch(planningRepositoryProvider)),
);

final planningProvider = AsyncNotifierProvider<PlanningNotifier, Planning>(
  PlanningNotifier.new,
);

class PlanningNotifier extends AsyncNotifier<Planning> {
  static const int initialPage = 1;
  static const int initialLimit = 100;

  String? _dateDebut;
  String? _dateFin;
  String? _stageId;
  int _page = initialPage;
  int _limit = initialLimit;

  String? get dateDebut => _dateDebut;
  String? get dateFin => _dateFin;
  String? get stageId => _stageId;
  int get page => _page;
  int get limit => _limit;

  @override
  Future<Planning> build() => _fetch();

  Future<Planning> _fetch() => ref.read(getPlanningUseCaseProvider).call(
        stageId: _stageId,
        dateDebut: _dateDebut,
        dateFin: _dateFin,
        page: _page,
        limit: _limit,
      );

  Future<void> _reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetch);
  }

  Future<void> load() => _reload();

  Future<void> setPeriod({String? dateDebut, String? dateFin}) async {
    _dateDebut = dateDebut;
    _dateFin = dateFin;
    _page = initialPage;
    await _reload();
  }

  Future<void> setStage(String? stageId) async {
    _stageId = stageId;
    _page = initialPage;
    await _reload();
  }

  Future<void> setPage(int page) async {
    _page = page < initialPage ? initialPage : page;
    await _reload();
  }

  Future<void> setLimit(int limit) async {
    _limit = limit < 1 ? initialLimit : limit;
    await _reload();
  }

  Future<void> refresh() => _reload();

  Future<void> retry() => _reload();
}

final planningIsEmptyProvider = Provider<bool>((ref) {
  final planning = ref.watch(planningProvider).value;
  if (planning == null) return false;
  return planning.evenements.isEmpty;
});
