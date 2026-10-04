import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/offres/domain/offre_repository.dart';
import 'package:steg_app/models/application_status.dart';
import 'package:steg_app/models/candidature.dart';
import 'package:steg_app/models/human_interview.dart';
import 'package:steg_app/models/offre.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/providers/candidatures/applications_providers.dart';
import 'package:steg_app/providers/offres/offres_providers.dart';

Candidature buildCandidature(String id, String statut) {
  return Candidature(
    id: id,
    stagiaireId: 's-1',
    offreId: 'o-1',
    statut: statut,
    stagiaireNom: 'Ben Ahmed',
    stagiairePrenom: 'Sami',
    offreTitre: 'Offre $id',
    departementNom: 'Informatique',
  );
}

class FakeOffreRepository implements OffreRepository {
  FakeOffreRepository({required this.candidatures});

  List<Candidature> candidatures;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) async {
    return const PaginatedResult(data: [], total: 0, page: 1, pages: 0);
  }

  @override
  Future<List<Candidature>> listMyCandidatures() async => List.of(candidatures);

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
  group('applicationsSectionsProvider', () {
    test('groups candidatures by status in enum order', () async {
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(
            FakeOffreRepository(
              candidatures: [
                buildCandidature('c1', 'ACCEPTEE'),
                buildCandidature('c2', 'EN_ATTENTE'),
                buildCandidature('c3', 'REFUSEE'),
                buildCandidature('c4', 'EN_ATTENTE'),
                buildCandidature('c5', 'STAGIAIRE_CREATED'),
              ],
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(myCandidaturesProvider.future);
      final sections = container.read(applicationsSectionsProvider);

      expect(
        sections.map((s) => s.status),
        [
          ApplicationStatut.enAttente,
          ApplicationStatut.acceptee,
          ApplicationStatut.refusee,
          ApplicationStatut.stagiaireCree,
        ],
      );
      expect(sections[0].items.map((c) => c.id), ['c2', 'c4']);
      expect(sections[1].items.map((c) => c.id), ['c1']);
      expect(sections[2].items.map((c) => c.id), ['c3']);
      expect(sections[3].items.map((c) => c.id), ['c5']);
    });

    test('drops candidatures with an unknown status', () async {
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(
            FakeOffreRepository(
              candidatures: [
                buildCandidature('c1', 'EN_ATTENTE'),
                buildCandidature('c2', 'AUTRE'),
              ],
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(myCandidaturesProvider.future);
      final sections = container.read(applicationsSectionsProvider);

      final total = sections.fold<int>(0, (sum, s) => sum + s.items.length);
      expect(total, 1);
      expect(sections[0].items.map((c) => c.id), ['c1']);
    });

    test('empty candidatures yield empty sections', () async {
      final container = ProviderContainer(
        overrides: [
          offreRepositoryProvider.overrideWithValue(
            FakeOffreRepository(candidatures: const []),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(myCandidaturesProvider.future);
      final sections = container.read(applicationsSectionsProvider);

      expect(sections.every((s) => s.items.isEmpty), isTrue);
    });
  });
}
