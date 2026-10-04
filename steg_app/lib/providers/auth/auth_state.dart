import '../../features/auth/domain/entities/auth_session.dart';

class AuthState {
  const AuthState({this.session});

  final AuthSession? session;

  bool get isAuthenticated => session != null;
}
