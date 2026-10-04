import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/document_onboarding.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/onboarding/document_onboarding_provider.dart';
import 'package:steg_app/screens/onboarding/document_onboarding_screen.dart';

import 'onboarding_utils.dart';

void main() {
  Widget buildScreen(FakeOnboardingRepository repo) {
    return ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(
          FakeAuthRepository(
            session: const AuthSession(accessToken: 't', user: candidat),
          ),
        ),
        onboardingRepositoryProvider.overrideWithValue(repo),
      ],
      child: const MaterialApp(home: DocumentOnboardingScreen()),
    );
  }

  testWidgets('0/4 : en-tête, progression et 4 boutons « Ajouter »',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Bienvenue dans STEG Internship'), findsOneWidget);
    expect(find.text('0/4 documents'), findsOneWidget);
    expect(find.text('Documents requis'), findsOneWidget);
    expect(find.text('Ajouter'), findsNWidgets(4));
    expect(find.text('Votre dossier est complet.'), findsNothing);
  });

  testWidgets('1/4 : progression mise à jour, document envoyé remplaçable',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {'CV': OnboardingDocumentStatus.enAttente},
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('1/4 document'), findsOneWidget);
    expect(find.text('Document envoyé'), findsOneWidget);
    expect(find.text('Remplacer'), findsOneWidget);
    expect(find.text('Ajouter'), findsNWidgets(3));
  });

  testWidgets('4/4 : dossier complet validé, accès accordé, CTA visible',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildValidated(),
    )));
    await tester.pumpAndSettle();

    expect(find.text('4/4 documents'), findsOneWidget);
    expect(find.text('Votre dossier est complet.'), findsOneWidget);
    expect(find.text('Accéder à mon espace'), findsOneWidget);
    expect(find.text('Ajouter'), findsNothing);
    expect(find.text('Remplacer'), findsNothing);
    expect(find.text('Document validé'), findsNWidgets(4));
  });

  testWidgets('4/4 : dossier complet non vérifié, accès refusé, bandeau info',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildComplete(),
      access: buildAccess(granted: false),
    )));
    await tester.pumpAndSettle();

    expect(find.text('4/4 documents'), findsOneWidget);
    expect(find.text('Vos documents sont en cours de vérification.'),
        findsOneWidget);
    expect(find.text('Votre dossier est complet.'), findsNothing);
    expect(find.text('Accéder à mon espace'), findsNothing);
  });

  testWidgets('un document manquant affiche « Ajouter », le dépôt attendu',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {'CV': OnboardingDocumentStatus.enAttente},
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Ajouter'), findsNWidgets(3));
    expect(find.text('CV'), findsOneWidget);
  });

  testWidgets('un document envoyé (EN_ATTENTE) propose « Remplacer »',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {'CV': OnboardingDocumentStatus.enAttente},
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Document envoyé'), findsOneWidget);
    expect(find.text('Remplacer'), findsOneWidget);
    expect(find.text('CV'), findsOneWidget);
  });

  testWidgets('un document rejeté demande un remplacement', (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {
          'CV': OnboardingDocumentStatus.rejete,
          'CIN': OnboardingDocumentStatus.enAttente,
          'DEMANDE_STAGE': OnboardingDocumentStatus.enAttente,
          'LETTRE_AFFECTATION': OnboardingDocumentStatus.enAttente,
        },
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Document rejeté'), findsOneWidget);
    expect(find.text('Remplacer'), findsNWidgets(4));
  });

  testWidgets(
      'document en cours de vérification : « Vérification en cours » et remplaçable',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {
          'CV': OnboardingDocumentStatus.verification,
          'CIN': OnboardingDocumentStatus.enAttente,
          'DEMANDE_STAGE': OnboardingDocumentStatus.enAttente,
          'LETTRE_AFFECTATION': OnboardingDocumentStatus.enAttente,
        },
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Vérification en cours'), findsOneWidget);
    expect(find.text('Remplacer'), findsNWidgets(4));
  });

  testWidgets(
      'document nécessitant une vérification manuelle : libellé dédié',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(
        statuses: {
          'CV': OnboardingDocumentStatus.reviewRequired,
          'CIN': OnboardingDocumentStatus.enAttente,
          'DEMANDE_STAGE': OnboardingDocumentStatus.enAttente,
          'LETTRE_AFFECTATION': OnboardingDocumentStatus.enAttente,
        },
      ),
    )));
    await tester.pumpAndSettle();

    expect(find.text('Document nécessitant une vérification'), findsOneWidget);
    expect(find.text('Remplacer'), findsNWidgets(4));
  });

  testWidgets('chargement en cours : indicateur d\'activité', (tester) async {
    final completer = Completer<DocumentOnboarding?>();
    final repo = FakeOnboardingRepository()..getOverride = () => completer.future;

    await tester.pumpWidget(buildScreen(repo));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    completer.complete(buildOnboarding());
    await tester.pumpAndSettle();

    expect(find.text('Bienvenue dans STEG Internship'), findsOneWidget);
  });

  testWidgets('échec du chargement : message + « Réessayer » recharge',
      (tester) async {
    final repo = FakeOnboardingRepository(onboarding: buildOnboarding())
      ..getError = Exception('boom');
    await tester.pumpWidget(buildScreen(repo));
    await tester.pumpAndSettle();

    expect(find.text('Impossible de charger votre dossier.'), findsOneWidget);

    repo.getError = null;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();

    expect(find.text('Bienvenue dans STEG Internship'), findsOneWidget);
    expect(find.text('Ajouter'), findsNWidgets(4));
  });

  testWidgets('échec du dépôt : bannière d\'erreur puis « Réessayer » réussit',
      (tester) async {
    final repo = FakeOnboardingRepository(onboarding: buildOnboarding())
      ..uploadErrorOnce = Exception('net');
    repo.onUpload = (type) => buildOnboarding(
          statuses: {type: OnboardingDocumentStatus.enAttente},
        );
    await tester.pumpWidget(buildScreen(repo));
    await tester.pumpAndSettle();

    // FilePicker ne peut pas s'exécuter dans les tests : on déclenche un échec
    // de dépôt via le notifier puis on enregistre l'erreur d'interface.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(DocumentOnboardingScreen)),
      listen: false,
    );
    await expectLater(
      container
          .read(documentOnboardingProvider.notifier)
          .uploadDocument(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          ),
      throwsA(isA<Exception>()),
    );
    container.read(onboardingUploadUiProvider.notifier).reportError(
          'Le document n\'a pas pu être envoyé.',
          const OnboardingUploadAttempt(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          ),
        );
    await tester.pump();

    expect(find.text('Le document n\'a pas pu être envoyé.'), findsOneWidget);

    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();

    expect(find.text('Le document n\'a pas pu être envoyé.'), findsNothing);
    expect(find.text('1/4 document'), findsOneWidget);
    expect(find.text('Document envoyé'), findsOneWidget);
  });

  testWidgets('dépôt réussi : la progression se met à jour immédiatement',
      (tester) async {
    final repo = FakeOnboardingRepository(onboarding: buildOnboarding());
    repo.onUpload = (type) => buildOnboarding(
          statuses: {type: OnboardingDocumentStatus.enAttente},
        );
    await tester.pumpWidget(buildScreen(repo));
    await tester.pumpAndSettle();

    expect(find.text('0/4 documents'), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(DocumentOnboardingScreen)),
      listen: false,
    );
    await container
        .read(documentOnboardingProvider.notifier)
        .uploadDocument(
          candidatureId: 'candidature-1',
          type: 'CV',
          filePath: '/tmp/cv.pdf',
        );
    await tester.pumpAndSettle();

    expect(find.text('1/4 document'), findsOneWidget);
    expect(find.text('Document envoyé'), findsOneWidget);
    expect(find.text('Remplacer'), findsOneWidget);
    expect(find.text('Ajouter'), findsNWidgets(3));
    expect(find.text('Votre dossier est complet.'), findsNothing);
  });

  testWidgets(
      'échec du dépôt : le message d\'erreur réel du backend s\'affiche au lieu du message générique',
      (tester) async {
    final repo = FakeOnboardingRepository(onboarding: buildOnboarding())
      ..uploadErrorOnce = ApiException(400, 'Type de document invalide.');
    repo.onUpload = (type) => buildOnboarding(
          statuses: {type: OnboardingDocumentStatus.enAttente},
        );
    await tester.pumpWidget(buildScreen(repo));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(DocumentOnboardingScreen)),
      listen: false,
    );
    await expectLater(
      container
          .read(documentOnboardingProvider.notifier)
          .uploadDocument(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          ),
      throwsA(isA<ApiException>()),
    );
    container.read(onboardingUploadUiProvider.notifier).reportError(
          'Le document n\'a pas pu être envoyé.',
          const OnboardingUploadAttempt(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          ),
        );
    await tester.pump();
    expect(find.text('Le document n\'a pas pu être envoyé.'), findsOneWidget);

    repo.uploadErrorOnce =
        ApiException(400, 'Fichier trop volumineux. Taille maximale : 10 Mo.');
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();

    expect(
      find.text('Fichier trop volumineux. Taille maximale : 10 Mo.'),
      findsOneWidget,
    );
    expect(find.text('Le document n\'a pas pu être envoyé.'), findsNothing);
  });

  testWidgets('la déconnexion reste accessible depuis l\'écran d\'onboarding',
      (tester) async {
    await tester.pumpWidget(buildScreen(FakeOnboardingRepository(
      onboarding: buildOnboarding(),
    )));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.logout), findsOneWidget);
  });
}
