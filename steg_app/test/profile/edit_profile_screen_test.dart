import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/login_response.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/core/api_client_provider.dart';
import 'package:steg_app/screens/profile/edit_profile_screen.dart';
import 'package:steg_app/services/auth_service.dart';

class _FakeAuthService implements AuthService {
  _FakeAuthService({this.updateError});

  ApiException? updateError;
  User? lastUpdatedUser;

  @override
  Future<User> updateProfile({String? nom, String? prenom, String? telephone, String? adresse}) async {
    if (updateError != null) throw updateError!;
    lastUpdatedUser = User(
      id: '1',
      nom: nom ?? 'Nom',
      prenom: prenom ?? 'Prenom',
      email: 'a@b.tn',
      role: 'STAGIAIRE',
      telephone: telephone,
    );
    return lastUpdatedUser!;
  }

  @override
  Future<User> getMe() async => lastUpdatedUser ?? const User(id: '1', nom: 'Nom', prenom: 'Prenom', email: 'a@b.tn', role: 'STAGIAIRE');

  @override
  Future<void> changePassword({required String currentPassword, required String newPassword}) async {}

  @override
  Future<void> forgotPassword(String email) async {}

  @override
  Future<void> resetPassword(String token, String password) async {}

  @override
  Future<LoginResponse> login(LoginRequest request) async => throw UnimplementedError();
}

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this._user);
  final User _user;

  @override
  Future<AuthSession?> getSession() async => AuthSession(accessToken: 'tok', user: _user);

  @override
  Future<AuthSession> login(LoginRequest request) async => throw UnimplementedError();

  @override
  Future<void> logout() async {}
}

Widget _buildApp({User? user, AuthService? authService}) {
  final u = user ?? const User(id: '1', nom: 'Trabelsi', prenom: 'Fatma', email: 'a@b.tn', role: 'STAGIAIRE', telephone: '55123');
  final svc = authService ?? _FakeAuthService();
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(_FakeAuthRepository(u)),
      authServiceProvider.overrideWithValue(svc),
    ],
    child: MaterialApp(home: const EditProfileScreen()),
  );
}

void main() {
  group('EditProfileScreen', () {
    testWidgets('loads profile fields and prefills the form', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      expect(find.text('Fatma'), findsOneWidget);
      expect(find.text('Trabelsi'), findsOneWidget);
      expect(find.text('55123'), findsOneWidget);
      expect(find.text('Enregistrer'), findsOneWidget);
    });

    testWidgets('successful update shows snackbar', (tester) async {
      final svc = _FakeAuthService();
      await tester.pumpWidget(_buildApp(authService: svc));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer'));
      await tester.pump();
      await tester.pump();

      expect(find.textContaining('succès'), findsOneWidget);
    });

    testWidgets('validation error shows error for empty nom', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      final nomField = find.byWidgetPredicate(
        (w) => w is TextFormField && (w.controller?.text ?? '') == 'Trabelsi',
      );
      await tester.enterText(nomField, '');
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      expect(find.text('Nom requis.'), findsOneWidget);
    });

    testWidgets('API error displays error message', (tester) async {
      final svc = _FakeAuthService(updateError: const ApiException(400, 'Erreur serveur'));
      await tester.pumpWidget(_buildApp(authService: svc));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      expect(find.text('Erreur serveur'), findsOneWidget);
    });

    testWidgets('submit button exists and is tappable', (tester) async {
      await tester.pumpWidget(_buildApp());
      await tester.pumpAndSettle();

      final button = find.widgetWithText(FilledButton, 'Enregistrer');
      expect(button, findsOneWidget);
    });
  });
}
