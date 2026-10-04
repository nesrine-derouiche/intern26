import '../../../../models/journal_entry.dart';
import '../journal_repository.dart';

class SubmitJournalUseCase {
  SubmitJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<JournalEntry> call(String id) {
    return _repository.submitJournal(id);
  }
}
