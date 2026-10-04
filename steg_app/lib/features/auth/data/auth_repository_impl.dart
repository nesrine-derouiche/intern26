import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../../../models/login_request.dart';
import '../../../services/auth_service.dart';
import '../domain/auth_repository.dart';
import '../domain/entities/auth_session.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthService authService,
    required TokenStorageInterface tokenStorage,
  })  : _authService = authService,
        _tokenStorage = tokenStorage;

  final AuthService _authService;
  final TokenStorageInterface _tokenStorage;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    final response = await _authService.login(request);
    await _tokenStorage.writeAccessToken(response.token);
    return AuthSession(accessToken: response.token, user: response.user);
  }

  @override
  Future<AuthSession?> getSession() async {
    final token = await _tokenStorage.readAccessToken();
    if (token == null || token.isEmpty) return null;
    try {
      final user = await _authService.getMe();
      return AuthSession(accessToken: token, user: user);
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await _tokenStorage.clear();
      }
      return null;
    }
  }

  @override
  Future<void> logout() async {
    await _tokenStorage.clear();
  }
}
