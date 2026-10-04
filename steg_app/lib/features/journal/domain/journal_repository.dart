import '../../../models/journal_entry.dart';
import '../../../models/paginated_result.dart';

abstract interface class JournalRepository {
  Future<PaginatedResult<JournalEntry>> listJournals({
    required int page,
    required int limit,
  });

  Future<JournalEntry> createJournal(JournalDraft draft);

  Future<JournalEntry> updateJournal({
    required String id,
    required JournalDraft draft,
  });

  Future<JournalEntry> submitJournal(String id);

  Future<JournalEntry> validateJournal(String id, {String commentaire = ''});

  Future<JournalEntry> rejectJournal(String id, {String commentaire = ''});

  Future<void> deleteJournal(String id);
}
