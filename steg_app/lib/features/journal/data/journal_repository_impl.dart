import '../../../models/journal_entry.dart';
import '../../../models/paginated_result.dart';
import '../../../services/journal_service.dart';
import '../domain/journal_repository.dart';

class JournalRepositoryImpl implements JournalRepository {
  JournalRepositoryImpl({required JournalService journalService})
      : _journalService = journalService;

  final JournalService _journalService;

  @override
  Future<PaginatedResult<JournalEntry>> listJournals({
    required int page,
    required int limit,
  }) {
    return _journalService.list(page: page, limit: limit);
  }

  @override
  Future<JournalEntry> createJournal(JournalDraft draft) {
    return _journalService.create(draft);
  }

  @override
  Future<JournalEntry> updateJournal({
    required String id,
    required JournalDraft draft,
  }) {
    return _journalService.update(id: id, draft: draft);
  }

  @override
  Future<JournalEntry> submitJournal(String id) {
    return _journalService.submit(id);
  }

  @override
  Future<JournalEntry> validateJournal(String id, {String commentaire = ''}) {
    return _journalService.validate(id, commentaire: commentaire);
  }

  @override
  Future<JournalEntry> rejectJournal(String id, {String commentaire = ''}) {
    return _journalService.reject(id, commentaire: commentaire);
  }

  @override
  Future<void> deleteJournal(String id) {
    return _journalService.delete(id);
  }
}
