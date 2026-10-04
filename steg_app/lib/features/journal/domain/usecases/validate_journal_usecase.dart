import '../../../../models/journal_entry.dart';
import '../journal_repository.dart';

class ValidateJournalUseCase {
  ValidateJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<JournalEntry> call(String id, {String commentaire = ''}) {
    return _repository.validateJournal(id, commentaire: commentaire);
  }
}
