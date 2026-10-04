import '../../../../models/tache.dart';
import '../dashboard_repository.dart';

class GetTachesUseCase {
  GetTachesUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<Tache>> call() => _repository.listTaches();
}
