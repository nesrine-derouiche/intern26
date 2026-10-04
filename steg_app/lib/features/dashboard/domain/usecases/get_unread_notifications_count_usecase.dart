import '../dashboard_repository.dart';

class GetUnreadNotificationsCountUseCase {
  GetUnreadNotificationsCountUseCase(this._repository);

  final DashboardRepository _repository;

  Future<int> call() => _repository.unreadNotificationsCount();
}
