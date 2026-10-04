import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/offres/domain/offre_repository.dart';
import 'package:steg_app/models/candidature.dart';
import 'package:steg_app/models/human_interview.dart';
import 'package:steg_app/models/offre.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/providers/offres/offres_providers.dart';

Offre buildOffre({
  required String id,
  required String titre,
  String departement = 'Transmission',
  String statut = 'OUVERTE',
}) {
  return Offre(
    id: id,
    titre: titre,
    description: '',
    duree: 6,
    competencesDemandees: '',
    nombrePlaces: 2,
    statut: statut,
    departementNom: departement,
    nbCandidatures: 0,
  );
}

class FakeOffreRepository implements OffreRepository {
  FakeOffreRepository({required this.offres});

  List<Offre> offres;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) async {
    final start = (page - 1) * limit;
    final data = offres.skip(start).take(limit).toList();
    return PaginatedResult(
      data: data,
      total: offres.length,
      page: page,
      pages: offres.isEmpty ? 0 : (offres.length / limit).ceil(),
    );
  }

  @override
  Future<List<Candidature>> listMyCandidatures() async => const [];

  @override
  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<HumanInterview?> getHumanInterview(String candidatureId) async => null;
}

void main() {
  group('OffresUiNotifier', () {
    test('loadMore reveals additional offers up to the filtered total', () async {
      final offres = [
        for (var i = 0; i < 12; i++) buildOffre(id: 'o-$i', titre: 'Offre $i'),
      ];
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(FakeOffreRepository(offres: offres)),
        ],
      );
      addTearDown(container.dispose);

      await container.read(offresListProvider.future);

      expect(container.read(offresVisibleProvider).length, offresInitialVisibleCount);

      container.read(offresUiProvider.notifier).loadMore(
            container.read(offresFilteredProvider).length,
          );
      expect(container.read(offresVisibleProvider).length, 12);

      container.read(offresUiProvider.notifier).loadMore(
            container.read(offresFilteredProvider).length,
          );
      expect(container.read(offresVisibleProvider).length, 12);
    });

    test('search narrows the filtered offers and resets pagination', () async {
      final offres = [
        buildOffre(id: '1', titre: 'Stage Réseaux'),
        buildOffre(id: '2', titre: 'Stage Distribution'),
        buildOffre(id: '3', titre: 'Stage Réseaux Fibre'),
      ];
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(FakeOffreRepository(offres: offres)),
        ],
      );
      addTearDown(container.dispose);

      await container.read(offresListProvider.future);

      container.read(offresUiProvider.notifier).loadMore(offres.length);
      expect(container.read(offresFilteredProvider).length, 3);

      container.read(offresUiProvider.notifier).setSearch('réseaux');
      final filtered = container.read(offresFilteredProvider);
      expect(filtered.map((o) => o.id), ['1', '3']);
      expect(container.read(offresVisibleProvider).length, 2);

      container.read(offresUiProvider.notifier).setSearch('');
      expect(container.read(offresFilteredProvider).length, 3);
    });

    test('statut and department filters combine', () async {
      final offres = [
        buildOffre(id: '1', titre: 'A', departement: 'Transmission', statut: 'OUVERTE'),
        buildOffre(id: '2', titre: 'B', departement: 'Distribution', statut: 'POURVUE'),
        buildOffre(id: '3', titre: 'C', departement: 'Transmission', statut: 'POURVUE'),
      ];
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(FakeOffreRepository(offres: offres)),
        ],
      );
      addTearDown(container.dispose);

      await container.read(offresListProvider.future);

      container.read(offresUiProvider.notifier).setStatut('POURVUE');
      container.read(offresUiProvider.notifier).setDepartement('Transmission');

      expect(
        container.read(offresFilteredProvider).map((o) => o.id),
        ['3'],
      );
      expect(container.read(offresUiProvider).activeFilterCount, 2);

      container.read(offresUiProvider.notifier).reset();
      expect(container.read(offresFilteredProvider).length, 3);
      expect(container.read(offresUiProvider).hasFilters, isFalse);
    });

    test('empty repository yields an empty visible list', () async {
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(FakeOffreRepository(offres: const [])),
        ],
      );
      addTearDown(container.dispose);

      final offers = await container.read(offresListProvider.future);
      expect(offers, isEmpty);
      expect(container.read(offresVisibleProvider), isEmpty);
    });
  });
}
