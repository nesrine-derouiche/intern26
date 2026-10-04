import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/auth_repository_impl.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/auth/domain/entities/auth_session.dart';
import '../../features/auth/domain/usecases/check_auth_usecase.dart';
import '../../features/auth/domain/usecases/login_usecase.dart';
import '../../features/auth/domain/usecases/logout_usecase.dart';
import '../../models/login_request.dart';
import '../core/api_client_provider.dart';
import 'auth_state.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    authService: ref.watch(authServiceProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});

final loginUseCaseProvider = Provider<LoginUseCase>(
  (ref) => LoginUseCase(ref.watch(authRepositoryProvider)),
);

final logoutUseCaseProvider = Provider<LogoutUseCase>(
  (ref) => LogoutUseCase(ref.watch(authRepositoryProvider)),
);

final checkAuthUseCaseProvider = Provider<CheckAuthUseCase>(
  (ref) => CheckAuthUseCase(ref.watch(authRepositoryProvider)),
);

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

class AuthNotifier extends AsyncNotifier<AuthState> {
  StreamSubscription<void>? _invalidationSubscription;

  @override
  Future<AuthState> build() async {
    ref.onDispose(() => _invalidationSubscription?.cancel());

    _invalidationSubscription =
        ref.read(sessionInvalidatorProvider).onInvalidated.listen((_) {
      _onUnauthorized();
    });

    final session = await ref.watch(checkAuthUseCaseProvider).call();
    return AuthState(session: session);
  }

  Future<void> login(LoginRequest request) async {
    state = const AsyncLoading();
    try {
      final session = await ref.read(loginUseCaseProvider).call(request);
      state = AsyncData(AuthState(session: session));
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
    }
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    await ref.read(logoutUseCaseProvider).call();
    state = const AsyncData(AuthState());
  }

  Future<void> refreshUser() async {
    final current = state.value;
    if (current == null || current.session == null) return;
    try {
      final user = await ref.read(authServiceProvider).getMe();
      state = AsyncData(AuthState(
        session: AuthSession(accessToken: current.session!.accessToken, user: user),
      ));
    } catch (_) {}
  }

  void _onUnauthorized() {
    state = const AsyncData(AuthState());
  }
}
