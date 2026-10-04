import '../../../../models/app_notification.dart';
import '../dashboard_repository.dart';

class GetNotificationsUseCase {
  GetNotificationsUseCase(this._repository);

  final DashboardRepository _repository;

  Future<List<AppNotification>> call() => _repository.listNotifications();
}
