import '../../../../models/reunion.dart';
import '../dashboard_repository.dart';

class GetReunionsUseCase {
  GetReunionsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<Reunion>> call() => _repository.listReunions();
}
