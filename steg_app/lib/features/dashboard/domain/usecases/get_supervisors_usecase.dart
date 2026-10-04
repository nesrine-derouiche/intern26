import '../../../../models/supervisor_info.dart';
import '../dashboard_repository.dart';

class GetSupervisorsUseCase {
  GetSupervisorsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<SupervisorInfo>> call() => _repository.listSupervisors();
}
