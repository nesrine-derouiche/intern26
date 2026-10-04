import '../../../../models/journal_entry.dart';
import '../journal_repository.dart';

class CreateJournalUseCase {
  CreateJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<JournalEntry> call(JournalDraft draft) {
    return _repository.createJournal(draft);
  }
}
