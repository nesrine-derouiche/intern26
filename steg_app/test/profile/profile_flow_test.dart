import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/internship.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/stagiaire_profile.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/profile/profile_providers.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import 'package:steg_app/screens/home/home_stagiaire_view.dart';
import 'package:steg_app/screens/profile/profile_screen.dart';
import 'package:steg_app/services/stagiaire_service.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeStagiaireService extends StagiaireService {
  FakeStagiaireService(this.profile) : super(Dio());

  final StagiaireProfile profile;

  @override
  Future<StagiaireProfile> getProfile(String id) async => profile;
}

StagiaireProfile buildProfile() {
  return StagiaireProfile(
    id: 's-1',
    nom: 'Ben Ahmed',
    prenom: 'Sami',
    email: 'sami@steg.tn',
    telephone: '22123456',
    ecole: 'ENIT',
    specialite: 'Génie logiciel',
    niveau: '3ème année',
    competences: 'Flutter, Dart, REST API',
    stages: [
      Internship.fromJson({
        'id': 'st-1',
        'date_debut': '2026-07-01',
        'date_fin': '2026-12-31',
        'statut': 'EN_COURS',
        'departement_nom': 'Informatique',
        'encadrant_nom': 'Trabelsi',
        'encadrant_prenom': 'Ahmed',
        'offre_titre': 'Stage développement web',
      }),
    ],
  );
}

Widget buildApp({
  required FakeAuthRepository auth,
  required FakeStagiaireService service,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      stagiaireServiceProvider.overrideWithValue(service),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
    ],
    child: const StegApp(),
  );
}

Widget buildScreen(FakeStagiaireService service) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
      ),
      stagiaireServiceProvider.overrideWithValue(service),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
    ],
    child: const MaterialApp(home: ProfileScreen()),
  );
}

void setSurface(WidgetTester tester, {double height = 2400}) {
  tester.view.physicalSize = Size(800, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  testWidgets('renders the compact LinkedIn-style profile for a stagiaire', (tester) async {
    setSurface(tester);

    await tester.pumpWidget(buildScreen(FakeStagiaireService(buildProfile())));
    await tester.pumpAndSettle();

    expect(find.text('Sami Ben Ahmed'), findsWidgets);
    expect(find.text('Stagiaire'), findsOneWidget);
    expect(find.text('Informatique'), findsWidgets);

    expect(find.text('Mon stage'), findsOneWidget);
    expect(find.text('Stage développement web'), findsOneWidget);
    expect(find.textContaining('%'), findsOneWidget);

    expect(find.byTooltip('Modifier le profil'), findsOneWidget);

    expect(find.text('Réglages'), findsOneWidget);
    expect(find.text('Déconnexion'), findsOneWidget);
  });

  testWidgets('opening settings and toggling push notifications updates the setting', (tester) async {
    setSurface(tester);

    await tester.pumpWidget(buildScreen(FakeStagiaireService(buildProfile())));
    await tester.pumpAndSettle();

    expect(find.byType(Switch), findsNothing);

    await tester.tap(find.text('Réglages'));
    await tester.pumpAndSettle();

    expect(find.text('Notifications push'), findsOneWidget);
    expect(find.byType(Switch), findsOneWidget);

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfileScreen)),
      listen: false,
    );
    expect(container.read(settingsProvider).pushNotifications, isFalse);
  });

  testWidgets('logout clears the auth session', (tester) async {
    setSurface(tester, height: 1600);

    await tester.pumpWidget(buildScreen(FakeStagiaireService(buildProfile())));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Déconnexion'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProfileScreen)),
      listen: false,
    );
    expect(container.read(authProvider).value?.isAuthenticated, isFalse);
  });

  testWidgets('non-stagiaire sees a compact profile with settings and logout only', (tester) async {
    setSurface(tester, height: 1600);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(
            FakeAuthRepository(
              session: const AuthSession(accessToken: 'token', user: admin),
            ),
          ),
          stagiaireServiceProvider.overrideWithValue(
            FakeStagiaireService(buildProfile()),
          ),
          stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
        ],
        child: const MaterialApp(home: ProfileScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Super Admin'), findsWidgets);
    expect(find.text('Administrateur'), findsOneWidget);
    expect(find.byTooltip('Modifier le profil'), findsOneWidget);
    expect(find.text('Réglages'), findsOneWidget);
    expect(find.text('Déconnexion'), findsOneWidget);

    expect(find.text('Mon stage'), findsNothing);
    expect(find.text('Informatique'), findsNothing);
  });

  testWidgets('home exposes the profile entry for all roles', (tester) async {
    setSurface(tester, height: 1600);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        service: FakeStagiaireService(buildProfile()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(HomeStagiaireView), findsOneWidget);

    final context = tester.element(find.byType(Scaffold).first);
    GoRouter.of(context).go(RoutePaths.profile);
    await tester.pumpAndSettle();

    expect(find.byType(ProfileScreen), findsOneWidget);
  });
}
