import '../dashboard_repository.dart';

class MarkAllNotificationsAsReadUseCase {
  MarkAllNotificationsAsReadUseCase(this._repository);

  final DashboardRepository _repository;

  Future<void> call() => _repository.markAllNotificationsAsRead();
}
