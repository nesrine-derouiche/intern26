import '../dashboard_repository.dart';

class MarkNotificationAsReadUseCase {
  MarkNotificationAsReadUseCase(this._repository);

  final DashboardRepository _repository;

  Future<void> call(String id) => _repository.markNotificationAsRead(id);
}
