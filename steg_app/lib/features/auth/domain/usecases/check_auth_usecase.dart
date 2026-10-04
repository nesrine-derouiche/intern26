import '../auth_repository.dart';
import '../entities/auth_session.dart';

class CheckAuthUseCase {
  CheckAuthUseCase(this._repository);

  final AuthRepository _repository;

  Future<AuthSession?> call() {
    return _repository.getSession();
  }
}
