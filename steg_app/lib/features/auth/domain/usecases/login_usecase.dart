import '../../../../models/login_request.dart';
import '../auth_repository.dart';
import '../entities/auth_session.dart';

class LoginUseCase {
  LoginUseCase(this._repository);

  final AuthRepository _repository;

  Future<AuthSession> call(LoginRequest request) {
    return _repository.login(request);
  }
}
