import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/document_onboarding.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/onboarding/document_onboarding_provider.dart';
import 'package:steg_app/providers/onboarding/internship_access_provider.dart';

import 'onboarding_utils.dart';

void main() {
  ProviderContainer buildContainer({
    required FakeAuthRepository auth,
    required FakeOnboardingRepository onboarding,
  }) {
    return ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(auth),
        onboardingRepositoryProvider.overrideWithValue(onboarding),
      ],
    );
  }

  group('documentOnboardingProvider', () {
    test('non-candidat: returns null without any repository call', () async {
      final repo = FakeOnboardingRepository()..getError = StateError('no net');
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: admin),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(documentOnboardingProvider.future);

      expect(state, isNull);
      expect(repo.getOnboardingCalls, 0);
    });

    test('sans session (non connecté): retourne null sans appel réseau',
        () async {
      final repo = FakeOnboardingRepository()..getError = StateError('no net');
      final container = buildContainer(
        auth: FakeAuthRepository(session: null),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(documentOnboardingProvider.future);

      expect(state, isNull);
      expect(repo.getOnboardingCalls, 0);
    });

    test('candidat dans la fenêtre: charge le dossier', () async {
      final repo = FakeOnboardingRepository(
        onboarding: buildOnboarding(
          statuses: {'CV': OnboardingDocumentStatus.enAttente},
        ),
      );
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(documentOnboardingProvider.future);

      expect(state, isNotNull);
      expect(state!.submitted, 1);
      expect(state.total, 4);
      expect(state.isComplete, isFalse);
      expect(repo.getOnboardingCalls, 1);
    });

    test('candidat hors fenêtre (aucune candidature validée): valeur null', () async {
      final repo = FakeOnboardingRepository(onboarding: null);
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(documentOnboardingProvider.future);

      expect(state, isNull);
      expect(repo.getOnboardingCalls, 1);
    });

    test('candidat: une erreur réseau est propagée', () async {
      final repo = FakeOnboardingRepository()
        ..getError = Exception('boom');
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      await expectLater(
        container.read(documentOnboardingProvider.future),
        throwsA(isA<Exception>()),
      );

      expect(container.read(documentOnboardingProvider).hasError, isTrue);
    });

    test('upload d\'un document manquant: le dossier est mis à jour', () async {
      final repo = FakeOnboardingRepository(onboarding: buildOnboarding());
      repo.onUpload = (type) => buildOnboarding(
            statuses: {type: OnboardingDocumentStatus.enAttente},
          );
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);
      await container.read(documentOnboardingProvider.future);

      final result = await container
          .read(documentOnboardingProvider.notifier)
          .uploadDocument(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          );

      expect(result.submitted, 1);
      expect(container.read(documentOnboardingProvider).value!.submitted, 1);
      expect(container.read(documentOnboardingProvider).value!.isComplete, isFalse);
      expect(repo.uploadCalls, 1);
    });

    test('dossier complet: isComplete true (verrouillé, pas d\'accès)', () async {
      final repo = FakeOnboardingRepository(onboarding: buildComplete());
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(documentOnboardingProvider.future);

      expect(state!.isComplete, isTrue);
      expect(state.submitted, 4);
      expect(state.total, 4);
    });
  });

  group('internshipAccessProvider', () {
    test('non-candidat: retourne null sans appel réseau', () async {
      final repo = FakeOnboardingRepository()..accessError = StateError('no');
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: admin),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(internshipAccessProvider.future);

      expect(state, isNull);
      expect(repo.getInternshipAccessCalls, 0);
    });

    test('candidat hors fenêtre (pas de dossier): retourne null', () async {
      final repo = FakeOnboardingRepository(onboarding: null);
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(internshipAccessProvider.future);

      expect(state, isNull);
      expect(repo.getInternshipAccessCalls, 0);
    });

    test('candidat dans la fenêtre: retourne le verdict d\'accès', () async {
      final repo = FakeOnboardingRepository(
        onboarding: buildValidated(),
        access: buildAccess(granted: false),
      );
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(internshipAccessProvider.future);

      expect(state, isNotNull);
      expect(state!.accessGranted, isFalse);
      expect(state.documents['cv'], 'EN_ATTENTE');
      expect(repo.getInternshipAccessCalls, 1);
    });

    test('accès accordé quand les 4 documents sont VALID', () async {
      final repo = FakeOnboardingRepository(
        onboarding: buildValidated(),
        access: buildAccess(),
      );
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      final state = await container.read(internshipAccessProvider.future);

      expect(state!.accessGranted, isTrue);
      expect(state.allValid, isTrue);
    });

    test('une erreur de vérification est propagée', () async {
      final repo = FakeOnboardingRepository(
        onboarding: buildValidated(),
        accessError: Exception('boom'),
      );
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);

      await expectLater(
        container.read(internshipAccessProvider.future),
        throwsA(isA<Exception>()),
      );
      expect(container.read(internshipAccessProvider).hasError, isTrue);
    });
  });

  group('onboardingUploadUiProvider', () {
    test('une erreur de dépôt est enregistrée avec la tentative à reprendre',
        () async {
      final repo = FakeOnboardingRepository(onboarding: buildOnboarding())
        ..uploadErrorOnce = Exception('net');
      final container = buildContainer(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 't', user: candidat),
        ),
        onboarding: repo,
      );
      addTearDown(container.dispose);
      await container.read(documentOnboardingProvider.future);

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

      container
          .read(onboardingUploadUiProvider.notifier)
          .reportError('Le document n\'a pas pu être envoyé.', const OnboardingUploadAttempt(
            candidatureId: 'candidature-1',
            type: 'CV',
            filePath: '/tmp/cv.pdf',
          ));

      final ui = container.read(onboardingUploadUiProvider);
      expect(ui.hasError, isTrue);
      expect(ui.errorMessage, 'Le document n\'a pas pu être envoyé.');
      expect(ui.pendingAttempt, isNotNull);
      expect(ui.pendingAttempt!.type, 'CV');
      expect(ui.pendingAttempt!.filePath, '/tmp/cv.pdf');

      container.read(onboardingUploadUiProvider.notifier).clearError();
      expect(container.read(onboardingUploadUiProvider).hasError, isFalse);
    });
  });
}
