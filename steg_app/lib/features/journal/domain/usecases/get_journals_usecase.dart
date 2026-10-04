import '../../../../models/journal_entry.dart';
import '../../../../models/paginated_result.dart';
import '../journal_repository.dart';

class GetJournalsUseCase {
  GetJournalsUseCase(this._repository);

  final JournalRepository _repository;

  Future<PaginatedResult<JournalEntry>> call({int page = 1, int limit = 50}) {
    return _repository.listJournals(page: page, limit: limit);
  }
}
