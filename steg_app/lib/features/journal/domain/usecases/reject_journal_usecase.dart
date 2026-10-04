import '../../../../models/journal_entry.dart';
import '../journal_repository.dart';

class RejectJournalUseCase {
  RejectJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<JournalEntry> call(String id, {String commentaire = ''}) {
    return _repository.rejectJournal(id, commentaire: commentaire);
  }
}
