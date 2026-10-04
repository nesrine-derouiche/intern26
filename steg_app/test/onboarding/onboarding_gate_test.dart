import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/routing/app_router.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/onboarding/document_onboarding_provider.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/auth/login_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import 'package:steg_app/screens/onboarding/document_onboarding_screen.dart';

import 'onboarding_utils.dart';

void main() {
  Widget buildApp({
    required FakeAuthRepository auth,
    required FakeOnboardingRepository onboarding,
  }) {
    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        onboardingRepositoryProvider.overrideWithValue(onboarding),
        stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
      ],
      child: const StegApp(),
    );
  }

  Widget buildCandidateApp(FakeOnboardingRepository onboarding) {
    return buildApp(
      auth: FakeAuthRepository(
        session: const AuthSession(accessToken: 't', user: candidat),
      ),
      onboarding: onboarding,
    );
  }

  testWidgets('candidat au dossier incomplet non vérifié : accès verrouillé '
      'sur l\'onboarding', (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildOnboarding(),
        access: buildAccess(granted: false),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    expect(find.text('0/4 documents'), findsOneWidget);
  });

  testWidgets('candidat au dossier complet non vérifié : reste verrouillé',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildComplete(),
        access: buildAccess(granted: false),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    expect(find.text('Vos documents sont en cours de vérification.'),
        findsOneWidget);
  });

  testWidgets('candidat au dossier validé : accès accordé et navigation libre',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildValidated(),
        access: buildAccess(),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Votre dossier est complet.'), findsOneWidget);
    expect(find.text('Accéder à mon espace'), findsOneWidget);

    // L'accès est accordé : la navigation vers le home est libre.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(DocumentOnboardingScreen)),
      listen: false,
    );
    container.read(appRouterProvider).go(RoutePaths.home);
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(DocumentOnboardingScreen), findsNothing);
  });

  testWidgets('CTA « Accéder à mon espace » : retour au home',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildValidated(),
        access: buildAccess(),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Accéder à mon espace'));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('candidat hors fenêtre d\'onboarding : accès accordé (home)',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(onboarding: null),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(DocumentOnboardingScreen), findsNothing);
  });

  testWidgets('candidat : erreur de chargement → écran d\'onboarding avec message',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = FakeOnboardingRepository()..getError = Exception('boom');
    await tester.pumpWidget(buildCandidateApp(repo));
    await tester.pumpAndSettle();

    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);
    expect(find.text('Impossible de charger votre dossier.'), findsOneWidget);
  });

  testWidgets(
      'erreur de vérification de l\'accès : on reste sur l\'onboarding',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildComplete(),
        accessError: Exception('boom'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    expect(find.text('Impossible de vérifier votre dossier.'), findsOneWidget);
  });

  testWidgets('non-candidat (stagiaire) : accès direct au home, sans blocage',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildApp(
      auth: FakeAuthRepository(
        session: const AuthSession(accessToken: 't', user: stagiaire),
      ),
      onboarding: FakeOnboardingRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(DocumentOnboardingScreen), findsNothing);
  });

  testWidgets('candidat bloqué : la navigation directe vers /home reste bloquée',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildOnboarding(),
        access: buildAccess(granted: false),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(DocumentOnboardingScreen)),
      listen: false,
    );
    container.read(appRouterProvider).go(RoutePaths.home);
    await tester.pumpAndSettle();

    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
  });

  testWidgets('la déconnexion depuis l\'onboarding ramène au login',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildCandidateApp(
      FakeOnboardingRepository(
        onboarding: buildOnboarding(),
        access: buildAccess(granted: false),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byType(DocumentOnboardingScreen), findsOneWidget);

    await tester.tap(find.byIcon(Icons.logout));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(DocumentOnboardingScreen), findsNothing);
  });
}
