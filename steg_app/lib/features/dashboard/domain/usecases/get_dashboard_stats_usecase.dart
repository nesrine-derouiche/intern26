import '../../../../models/dashboard_stats.dart';
import '../dashboard_repository.dart';

class GetDashboardStatsUseCase {
  GetDashboardStatsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<DashboardStats> call() => _repository.getDashboardStats();
}
