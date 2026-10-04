import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/core/api_client_provider.dart';
import 'package:steg_app/screens/auth/forgot_password_screen.dart';
import 'package:steg_app/screens/auth/login_screen.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import 'package:steg_app/services/auth_service.dart';
import 'package:steg_app/models/login_response.dart';

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    final result = AuthSession(
      accessToken: 'fake-token',
      user: const User(
        id: '1',
        nom: 'Admin',
        prenom: 'Super',
        email: 'admin@steg.tn',
        role: 'ADMIN',
      ),
    );
    session = result;
    return result;
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeAuthService implements AuthService {
  FakeAuthService({this.shouldFail = false});

  final bool shouldFail;

  @override
  Future<void> forgotPassword(String email) async {
    if (shouldFail) {
      throw const ApiException(500, 'Erreur serveur');
    }
  }

  @override
  Future<void> resetPassword(String token, String password) async {}

  @override
  Future<LoginResponse> login(LoginRequest request) async {
    return const LoginResponse(
      message: 'ok',
      token: 'fake-token',
      user: User(
        id: '1',
        nom: 'Admin',
        prenom: 'Super',
        email: 'admin@steg.tn',
        role: 'ADMIN',
      ),
    );
  }

  @override
  Future<User> getMe() async {
    throw UnimplementedError();
  }

  @override
  Future<User> updateProfile({String? nom, String? prenom, String? telephone, String? adresse}) async {
    throw UnimplementedError();
  }

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    throw UnimplementedError();
  }
}

ProviderScope buildApp(FakeAuthRepository repository, {AuthService? authService}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(repository),
      if (authService != null) authServiceProvider.overrideWithValue(authService),
    ],
    child: const StegApp(),
  );
}

void main() {
  const admin = User(
    id: '1',
    nom: 'Admin',
    prenom: 'Super',
    email: 'admin@steg.tn',
    role: 'ADMIN',
  );

  testWidgets('redirects to login when no session exists', (tester) async {
    await tester.pumpWidget(buildApp(FakeAuthRepository()));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('restores the session and goes to home (persistent login)', (tester) async {
    await tester.pumpWidget(
      buildApp(
        FakeAuthRepository(
          session: const AuthSession(accessToken: 'stored-token', user: admin),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Super Admin'), findsOneWidget);
  });

  testWidgets('login navigates to home on success', (tester) async {
    await tester.pumpWidget(buildApp(FakeAuthRepository()));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byType(TextField).at(0),
      'admin@steg.tn',
    );
    await tester.enterText(find.byType(TextField).at(1), 'admin123');
    await tester.tap(find.text('Se connecter'));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('forgot password link opens the form screen', (tester) async {
    await tester.pumpWidget(buildApp(FakeAuthRepository(), authService: FakeAuthService()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mot de passe oublié ?'));
    await tester.pumpAndSettle();

    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
    expect(find.text('Envoyer le lien'), findsOneWidget);
  });

  testWidgets('forgot password calls API and shows confirmation on success', (tester) async {
    await tester.pumpWidget(buildApp(FakeAuthRepository(), authService: FakeAuthService()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mot de passe oublié ?'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'user@steg.tn');
    await tester.tap(find.text('Envoyer le lien'));
    await tester.pumpAndSettle();

    expect(find.text('Demande envoyée'), findsOneWidget);
    expect(find.textContaining('user@steg.tn'), findsOneWidget);
  });

  testWidgets('forgot password shows error on API failure', (tester) async {
    await tester.pumpWidget(buildApp(
      FakeAuthRepository(),
      authService: FakeAuthService(shouldFail: true),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Mot de passe oublié ?'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'user@steg.tn');
    await tester.tap(find.text('Envoyer le lien'));
    await tester.pumpAndSettle();

    expect(find.text('Erreur serveur'), findsOneWidget);
    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
  });

  testWidgets('logout returns to the login screen', (tester) async {
    await tester.pumpWidget(
      buildApp(
        FakeAuthRepository(
          session: const AuthSession(accessToken: 'stored-token', user: admin),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
