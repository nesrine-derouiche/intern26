import '../dashboard_repository.dart';

class DeleteNotificationUseCase {
  DeleteNotificationUseCase(this._repository);

  final DashboardRepository _repository;

  Future<void> call(String id) => _repository.deleteNotification(id);
}
