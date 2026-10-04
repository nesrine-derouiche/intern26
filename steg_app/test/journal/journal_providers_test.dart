import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/journal/domain/journal_repository.dart';
import 'package:steg_app/models/journal_entry.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/providers/journal/journal_providers.dart';

class FakeJournalRepository implements JournalRepository {
  FakeJournalRepository({List<JournalEntry>? journals})
      : journals = journals ?? [];

  List<JournalEntry> journals;
  int createCount = 0;
  int submitCount = 0;
  int deleteCount = 0;

  @override
  Future<PaginatedResult<JournalEntry>> listJournals({
    required int page,
    required int limit,
  }) async {
    return PaginatedResult(
      data: List.of(journals),
      total: journals.length,
      page: 1,
      pages: journals.isEmpty ? 0 : 1,
    );
  }

  @override
  Future<JournalEntry> createJournal(JournalDraft draft) async {
    createCount++;
    final entry = JournalEntry.fromJson({
      'id': 'created-$createCount',
      'stage_id': draft.stageId,
      'semaine': '2026-01-12',
      'travaux': draft.travaux,
      'heures': draft.heures,
      'statut': 'BROUILLON',
    });
    journals.add(entry);
    return entry;
  }

  @override
  Future<JournalEntry> updateJournal({
    required String id,
    required JournalDraft draft,
  }) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'stage_id': journals[index].stageId,
      'semaine': '2026-01-12',
      'travaux': draft.travaux,
      'heures': draft.heures,
      'statut': 'BROUILLON',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> submitJournal(String id) async {
    submitCount++;
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'SOUMIS',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> validateJournal(String id, {String commentaire = ''}) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'VALIDE',
      'commentaire_encadrant': commentaire,
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> rejectJournal(String id, {String commentaire = ''}) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'REJETE',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<void> deleteJournal(String id) async {
    deleteCount++;
    journals.removeWhere((j) => j.id == id);
  }
}

JournalEntry journal(String id, String semaine, String statut) {
  return JournalEntry.fromJson({
    'id': id,
    'stage_id': 's1',
    'semaine': semaine,
    'travaux': 'Travaux $id',
    'heures': '36',
    'statut': statut,
  });
}

void main() {
  group('myJournalsProvider', () {
    test('loads and sorts journals by week descending', () async {
      final repository = FakeJournalRepository(journals: [
        journal('w1', '2026-01-05', 'SOUMIS'),
        journal('w2', '2026-01-12', 'VALIDE'),
        journal('w3', '2025-12-29', 'BROUILLON'),
      ]);
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      final journals = await container.read(myJournalsProvider.future);
      expect(journals.map((j) => j.id), ['w2', 'w1', 'w3']);
    });

    test('create adds the new journal to the list', () async {
      final repository = FakeJournalRepository();
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      final created = await container.read(myJournalsProvider.notifier).create(
            JournalDraft(
              stageId: 's1',
              semaine: DateTime(2026, 1, 12),
              travaux: 'Premier journal',
            ),
          );

      expect(created.id, 'created-1');
      final journals = container.read(myJournalsProvider).value!;
      expect(journals.map((j) => j.id), contains('created-1'));
    });

    test('submit marks the journal as SOUMIS in place', () async {
      final repository =
          FakeJournalRepository(journals: [journal('j1', '2026-01-12', 'BROUILLON')]);
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      await container.read(myJournalsProvider.notifier).submit('j1');

      final journals = container.read(myJournalsProvider).value!;
      expect(journals.first.statut, JournalStatut.soumis);
      expect(repository.submitCount, 1);
    });

    test('validate marks the journal as VALIDE', () async {
      final repository =
          FakeJournalRepository(journals: [journal('j1', '2026-01-12', 'SOUMIS')]);
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      await container.read(myJournalsProvider.notifier).validate(
            'j1',
            commentaire: 'Bravo',
          );

      final journals = container.read(myJournalsProvider).value!;
      expect(journals.first.statut, JournalStatut.valide);
      expect(journals.first.commentaireEncadrant, 'Bravo');
    });

    test('reject marks the journal as REJETE', () async {
      final repository =
          FakeJournalRepository(journals: [journal('j1', '2026-01-12', 'SOUMIS')]);
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      await container.read(myJournalsProvider.notifier).reject('j1');

      final journals = container.read(myJournalsProvider).value!;
      expect(journals.first.statut, JournalStatut.rejete);
    });

    test('delete removes the journal from the list', () async {
      final repository = FakeJournalRepository(
        journals: [journal('j1', '2026-01-12', 'BROUILLON')],
      );
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      await container.read(myJournalsProvider.notifier).delete('j1');

      final journals = container.read(myJournalsProvider).value!;
      expect(journals, isEmpty);
      expect(repository.deleteCount, 1);
    });

    test('updateJournal replaces the journal content', () async {
      final repository = FakeJournalRepository(
        journals: [journal('j1', '2026-01-12', 'BROUILLON')],
      );
      final container = ProviderContainer(
        overrides: [journalRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      await container.read(myJournalsProvider.future);
      await container.read(myJournalsProvider.notifier).updateJournal(
            id: 'j1',
            draft: const JournalDraft(travaux: 'Nouveau contenu', heures: 40),
          );

      final journals = container.read(myJournalsProvider).value!;
      expect(journals.first.travaux, 'Nouveau contenu');
    });
  });
}
