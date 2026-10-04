import '../../../models/login_request.dart';
import 'entities/auth_session.dart';

abstract interface class AuthRepository {
  Future<AuthSession> login(LoginRequest request);

  Future<AuthSession?> getSession();

  Future<void> logout();
}
