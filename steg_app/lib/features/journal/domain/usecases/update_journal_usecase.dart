import '../../../../models/journal_entry.dart';
import '../journal_repository.dart';

class UpdateJournalUseCase {
  UpdateJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<JournalEntry> call({
    required String id,
    required JournalDraft draft,
  }) {
    return _repository.updateJournal(id: id, draft: draft);
  }
}
