import '../../../../models/offre.dart';
import '../../../../models/paginated_result.dart';
import '../offre_repository.dart';

class GetOffresUseCase {
  GetOffresUseCase(this._repository);

  final OffreRepository _repository;

  Future<PaginatedResult<Offre>> call({int page = 1, int limit = 20}) {
    return _repository.listOffres(page: page, limit: limit);
  }
}
