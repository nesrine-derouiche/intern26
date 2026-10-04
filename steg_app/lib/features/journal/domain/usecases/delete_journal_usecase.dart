import '../journal_repository.dart';

class DeleteJournalUseCase {
  DeleteJournalUseCase(this._repository);

  final JournalRepository _repository;

  Future<void> call(String id) {
    return _repository.deleteJournal(id);
  }
}
