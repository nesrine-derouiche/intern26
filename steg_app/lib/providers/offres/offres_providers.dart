import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/offres/data/offre_repository_impl.dart';
import '../../features/offres/domain/offre_repository.dart';
import '../../features/offres/domain/usecases/apply_to_offre_usecase.dart';
import '../../features/offres/domain/usecases/get_human_interview_usecase.dart';
import '../../features/offres/domain/usecases/get_my_candidatures_usecase.dart';
import '../../features/offres/domain/usecases/get_offres_usecase.dart';
import '../../models/candidature.dart';
import '../../models/human_interview.dart';
import '../../models/offre.dart';
import '../../services/candidature_service.dart';
import '../../services/offre_service.dart';
import '../core/api_client_provider.dart';

final offreServiceProvider = Provider<OffreService>(
  (ref) => OffreService(ref.watch(dioProvider)),
);

final candidatureServiceProvider = Provider<CandidatureService>(
  (ref) => CandidatureService(ref.watch(dioProvider)),
);

final offreRepositoryProvider = Provider<OffreRepository>(
  (ref) => OffreRepositoryImpl(
    offreService: ref.watch(offreServiceProvider),
    candidatureService: ref.watch(candidatureServiceProvider),
  ),
);

final getOffresUseCaseProvider = Provider<GetOffresUseCase>(
  (ref) => GetOffresUseCase(ref.watch(offreRepositoryProvider)),
);

final getMyCandidaturesUseCaseProvider = Provider<GetMyCandidaturesUseCase>(
  (ref) => GetMyCandidaturesUseCase(ref.watch(offreRepositoryProvider)),
);

final applyToOffreUseCaseProvider = Provider<ApplyToOffreUseCase>(
  (ref) => ApplyToOffreUseCase(ref.watch(offreRepositoryProvider)),
);

final getHumanInterviewUseCaseProvider = Provider<GetHumanInterviewUseCase>(
  (ref) => GetHumanInterviewUseCase(ref.watch(offreRepositoryProvider)),
);

/// Entretien humain de la candidature (null si aucun entretien planifié).
final humanInterviewProvider = FutureProvider.family<HumanInterview?, String>(
  (ref, candidatureId) =>
      ref.watch(getHumanInterviewUseCaseProvider).call(candidatureId),
);

final offresListProvider =
    AsyncNotifierProvider<OffresListNotifier, List<Offre>>(OffresListNotifier.new);

class OffresListNotifier extends AsyncNotifier<List<Offre>> {
  static const int _pageSize = 100;

  @override
  Future<List<Offre>> build() => _fetchAll();

  Future<List<Offre>> _fetchAll() async {
    final useCase = ref.read(getOffresUseCaseProvider);
    final first = await useCase.call(page: 1, limit: _pageSize);
    final offers = [...first.data];
    for (var page = 2; page <= first.pages; page++) {
      final result = await useCase.call(page: page, limit: _pageSize);
      offers.addAll(result.data);
    }
    return offers;
  }

  Future<void> refresh() async {
    final next = await AsyncValue.guard(_fetchAll);
    state = next;
  }
}

final myCandidaturesProvider =
    AsyncNotifierProvider<MyCandidaturesNotifier, List<Candidature>>(
  MyCandidaturesNotifier.new,
);

class MyCandidaturesNotifier extends AsyncNotifier<List<Candidature>> {
  @override
  Future<List<Candidature>> build() async {
    final useCase = ref.read(getMyCandidaturesUseCaseProvider);
    return useCase.call();
  }
}

final appliedOffreIdsProvider = Provider<Set<String>>((ref) {
  final candidatures = ref.watch(myCandidaturesProvider).value ?? const <Candidature>[];
  return candidatures.map((candidature) => candidature.offreId).toSet();
});

const int offresInitialVisibleCount = 10;

class OffresFilters {
  const OffresFilters({
    this.search = '',
    this.statut,
    this.departement,
    this.visibleCount = offresInitialVisibleCount,
  });

  final String search;
  final String? statut;
  final String? departement;
  final int visibleCount;

  bool get hasFilters => search.isNotEmpty || statut != null || departement != null;

  int get activeFilterCount {
    final count = (search.isNotEmpty ? 1 : 0) +
        (statut != null ? 1 : 0) +
        (departement != null ? 1 : 0);
    return count;
  }

  static const Object _unset = Object();

  OffresFilters copyWith({
    Object? search = _unset,
    Object? statut = _unset,
    Object? departement = _unset,
    Object? visibleCount = _unset,
  }) {
    return OffresFilters(
      search: identical(search, _unset) ? this.search : search as String,
      statut: identical(statut, _unset) ? this.statut : statut as String?,
      departement: identical(departement, _unset)
          ? this.departement
          : departement as String?,
      visibleCount:
          identical(visibleCount, _unset) ? this.visibleCount : visibleCount as int,
    );
  }
}

final offresUiProvider =
    NotifierProvider<OffresUiNotifier, OffresFilters>(OffresUiNotifier.new);

class OffresUiNotifier extends Notifier<OffresFilters> {
  static const int _pageSize = offresInitialVisibleCount;

  @override
  OffresFilters build() => const OffresFilters();

  void setSearch(String value) {
    state = state.copyWith(search: value.trim(), visibleCount: _pageSize);
  }

  void setStatut(String? value) {
    state = state.copyWith(statut: value, visibleCount: _pageSize);
  }

  void setDepartement(String? value) {
    state = state.copyWith(departement: value, visibleCount: _pageSize);
  }

  void reset() {
    state = const OffresFilters();
  }

  void loadMore(int total) {
    if (state.visibleCount >= total) return;
    state = state.copyWith(visibleCount: state.visibleCount + _pageSize);
  }
}

final offresFilteredProvider = Provider<List<Offre>>((ref) {
  final all = ref.watch(offresListProvider).value ?? const <Offre>[];
  final filters = ref.watch(offresUiProvider);
  final query = filters.search.toLowerCase();

  return all.where((offre) {
    if (query.isNotEmpty) {
      final haystack = '${offre.titre} ${offre.departementNom} '
          '${offre.competencesDemandees}'
          .toLowerCase();
      if (!haystack.contains(query)) return false;
    }
    if (filters.statut != null && offre.statut != filters.statut) return false;
    if (filters.departement != null && offre.departementNom != filters.departement) {
      return false;
    }
    return true;
  }).toList();
});

final offresVisibleProvider = Provider<List<Offre>>((ref) {
  final filtered = ref.watch(offresFilteredProvider);
  final visibleCount = ref.watch(offresUiProvider).visibleCount;
  return filtered.take(visibleCount).toList();
});
