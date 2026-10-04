import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/journal/data/journal_repository_impl.dart';
import '../../features/journal/domain/journal_repository.dart';
import '../../features/journal/domain/usecases/create_journal_usecase.dart';
import '../../features/journal/domain/usecases/delete_journal_usecase.dart';
import '../../features/journal/domain/usecases/get_journals_usecase.dart';
import '../../features/journal/domain/usecases/reject_journal_usecase.dart';
import '../../features/journal/domain/usecases/submit_journal_usecase.dart';
import '../../features/journal/domain/usecases/update_journal_usecase.dart';
import '../../features/journal/domain/usecases/validate_journal_usecase.dart';
import '../../models/journal_entry.dart';
import '../../services/journal_service.dart';
import '../core/api_client_provider.dart';

final journalServiceProvider = Provider<JournalService>(
  (ref) => JournalService(ref.watch(dioProvider)),
);

final journalRepositoryProvider = Provider<JournalRepository>(
  (ref) => JournalRepositoryImpl(
    journalService: ref.watch(journalServiceProvider),
  ),
);

final getJournalsUseCaseProvider = Provider<GetJournalsUseCase>(
  (ref) => GetJournalsUseCase(ref.watch(journalRepositoryProvider)),
);

final createJournalUseCaseProvider = Provider<CreateJournalUseCase>(
  (ref) => CreateJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final updateJournalUseCaseProvider = Provider<UpdateJournalUseCase>(
  (ref) => UpdateJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final submitJournalUseCaseProvider = Provider<SubmitJournalUseCase>(
  (ref) => SubmitJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final validateJournalUseCaseProvider = Provider<ValidateJournalUseCase>(
  (ref) => ValidateJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final rejectJournalUseCaseProvider = Provider<RejectJournalUseCase>(
  (ref) => RejectJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final deleteJournalUseCaseProvider = Provider<DeleteJournalUseCase>(
  (ref) => DeleteJournalUseCase(ref.watch(journalRepositoryProvider)),
);

final myJournalsProvider =
    AsyncNotifierProvider<MyJournalsNotifier, List<JournalEntry>>(
  MyJournalsNotifier.new,
);

class MyJournalsNotifier extends AsyncNotifier<List<JournalEntry>> {
  static const int _pageSize = 100;

  @override
  Future<List<JournalEntry>> build() => _fetchAll();

  Future<List<JournalEntry>> _fetchAll() async {
    final useCase = ref.read(getJournalsUseCaseProvider);
    final first = await useCase.call(page: 1, limit: _pageSize);
    final journals = [...first.data];
    for (var page = 2; page <= first.pages; page++) {
      final result = await useCase.call(page: page, limit: _pageSize);
      journals.addAll(result.data);
    }
    journals.sort((a, b) => (b.semaine ?? DateTime(1900)).compareTo(a.semaine ?? DateTime(1900)));
    return journals;
  }

  Future<void> refresh() async {
    final next = await AsyncValue.guard(_fetchAll);
    state = next;
  }

  void _upsert(JournalEntry entry) {
    final current = state.value;
    if (current == null) return;
    final others = current.where((j) => j.id != entry.id).toList();
    final updated = [...others, entry];
    updated.sort((a, b) => (b.semaine ?? DateTime(1900)).compareTo(a.semaine ?? DateTime(1900)));
    state = AsyncData(updated);
  }

  void _remove(String id) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.where((j) => j.id != id).toList());
  }

  Future<JournalEntry> create(JournalDraft draft) async {
    final entry = await ref.read(createJournalUseCaseProvider).call(draft);
    _upsert(entry);
    return entry;
  }

  Future<JournalEntry> updateJournal({
    required String id,
    required JournalDraft draft,
  }) async {
    final entry =
        await ref.read(updateJournalUseCaseProvider).call(id: id, draft: draft);
    _upsert(entry);
    return entry;
  }

  Future<void> submit(String id) async {
    final entry = await ref.read(submitJournalUseCaseProvider).call(id);
    _upsert(entry);
  }

  Future<void> validate(String id, {String commentaire = ''}) async {
    final entry =
        await ref.read(validateJournalUseCaseProvider).call(id, commentaire: commentaire);
    _upsert(entry);
  }

  Future<void> reject(String id, {String commentaire = ''}) async {
    final entry =
        await ref.read(rejectJournalUseCaseProvider).call(id, commentaire: commentaire);
    _upsert(entry);
  }

  Future<void> delete(String id) async {
    await ref.read(deleteJournalUseCaseProvider).call(id);
    _remove(id);
  }
}
