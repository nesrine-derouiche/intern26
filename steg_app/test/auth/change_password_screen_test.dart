import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/auth/session_invalidator.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/core/storage/token_storage.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/login_response.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/core/api_client_provider.dart';
import 'package:steg_app/screens/auth/change_password_screen.dart';
import 'package:steg_app/services/auth_service.dart';

class _FakeTokenStorage implements TokenStorageInterface {
  bool cleared = false;

  @override
  Future<String?> readAccessToken() async => 'fake-token';

  @override
  Future<String?> readRefreshToken() async => null;

  @override
  Future<void> writeAccessToken(String token) async {}

  @override
  Future<void> writeRefreshToken(String token) async {}

  @override
  Future<void> clear() async => cleared = true;
}

class _FakeAuthService implements AuthService {
  _FakeAuthService({this.changeError});

  ApiException? changeError;
  bool changeCalled = false;

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {
    changeCalled = true;
    if (changeError != null) throw changeError!;
  }

  @override
  Future<User> getMe() async => const User(id: '1', nom: 'Nom', prenom: 'Prenom', email: 'a@b.tn', role: 'STAGIAIRE');

  @override
  Future<User> updateProfile({String? nom, String? prenom, String? telephone, String? adresse}) async => throw UnimplementedError();

  @override
  Future<void> forgotPassword(String email) async {}

  @override
  Future<void> resetPassword(String token, String password) async {}

  @override
  Future<LoginResponse> login(LoginRequest request) async => throw UnimplementedError();
}

class _FakeAuthRepository implements AuthRepository {
  bool loggedOut = false;

  @override
  Future<AuthSession?> getSession() async => const AuthSession(
    accessToken: 'tok',
    user: User(id: '1', nom: 'Nom', prenom: 'Prenom', email: 'a@b.tn', role: 'STAGIAIRE'),
  );

  @override
  Future<AuthSession> login(LoginRequest request) async => throw UnimplementedError();

  @override
  Future<void> logout() async => loggedOut = true;
}

Widget _buildApp({
  AuthService? authService,
  TokenStorageInterface? tokenStorage,
  SessionInvalidator? invalidator,
}) {
  final svc = authService ?? _FakeAuthService();
  final storage = tokenStorage ?? _FakeTokenStorage();
  final inv = invalidator ?? SessionInvalidator.instance;
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
      authServiceProvider.overrideWithValue(svc),
      tokenStorageProvider.overrideWithValue(storage),
      sessionInvalidatorProvider.overrideWithValue(inv),
    ],
    child: MaterialApp(home: const ChangePasswordScreen()),
  );
}

void main() {
  group('ChangePasswordScreen', () {
    testWidgets('renders all password fields and submit button', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      expect(find.text('Mot de passe actuel'), findsOneWidget);
      expect(find.text('Nouveau mot de passe'), findsOneWidget);
      expect(find.text('Confirmer le mot de passe'), findsOneWidget);
      expect(find.text('Modifier le mot de passe'), findsOneWidget);
    });

    testWidgets('validation error for empty current password', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Modifier le mot de passe'));
      await tester.pumpAndSettle();

      expect(find.text('Mot de passe actuel requis.'), findsOneWidget);
    });

    testWidgets('validation error for weak new password', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Current1');
      await tester.enterText(fields.at(1), 'weak');
      await tester.tap(find.text('Modifier le mot de passe'));
      await tester.pumpAndSettle();

      expect(find.text('8 caractères minimum.'), findsOneWidget);
    });

    testWidgets('validation error for password mismatch', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Current1');
      await tester.enterText(fields.at(1), 'NewPass123');
      await tester.enterText(fields.at(2), 'Different1');
      await tester.tap(find.text('Modifier le mot de passe'));
      await tester.pumpAndSettle();

      expect(find.text('Les mots de passe ne correspondent pas.'), findsOneWidget);
    });

    testWidgets('API error displays error message', (tester) async {
      final svc = _FakeAuthService(changeError: const ApiException(401, 'Mot de passe actuel incorrect'));
      await tester.pumpWidget(_buildApp(authService: svc));
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Current1');
      await tester.enterText(fields.at(1), 'NewPass123');
      await tester.enterText(fields.at(2), 'NewPass123');
      await tester.tap(find.text('Modifier le mot de passe'));
      await tester.pumpAndSettle();

      expect(find.text('Mot de passe actuel incorrect'), findsOneWidget);
    });

    testWidgets('successful change calls logout and shows message', (tester) async {
      final svc = _FakeAuthService();
      final storage = _FakeTokenStorage();
      await tester.pumpWidget(_buildApp(authService: svc, tokenStorage: storage));
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Current1');
      await tester.enterText(fields.at(1), 'NewPass123');
      await tester.enterText(fields.at(2), 'NewPass123');
      await tester.tap(find.text('Modifier le mot de passe'));
      await tester.pumpAndSettle();

      expect(svc.changeCalled, isTrue);
      expect(storage.cleared, isTrue);
    });

    testWidgets('submit button exists and is tappable', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      final button = find.widgetWithText(FilledButton, 'Modifier le mot de passe');
      expect(button, findsOneWidget);
    });
  });
}
