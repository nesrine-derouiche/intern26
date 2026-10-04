import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/onboarding/data/onboarding_repository_impl.dart';
import '../../features/onboarding/domain/onboarding_repository.dart';
import '../../features/onboarding/domain/usecases/get_onboarding_usecase.dart';
import '../../features/onboarding/domain/usecases/upload_onboarding_document_usecase.dart';
import '../../models/document_onboarding.dart';
import '../../services/document_onboarding_service.dart';
import '../auth/auth_provider.dart';
import '../core/api_client_provider.dart';

final onboardingServiceProvider = Provider<DocumentOnboardingService>(
  (ref) => DocumentOnboardingService(ref.watch(dioProvider)),
);

final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => OnboardingRepositoryImpl(service: ref.watch(onboardingServiceProvider)),
);

final getOnboardingUseCaseProvider = Provider<GetOnboardingUseCase>(
  (ref) => GetOnboardingUseCase(ref.watch(onboardingRepositoryProvider)),
);

final uploadOnboardingDocumentUseCaseProvider =
    Provider<UploadOnboardingDocumentUseCase>(
  (ref) => UploadOnboardingDocumentUseCase(ref.watch(onboardingRepositoryProvider)),
);

/// État du dossier de candidature du candidat connecté.
///
/// `null` quand :
///  - l'utilisateur n'est pas un candidat (porte-garantie : aucun accès réseau),
///  - le candidat n'est pas encore dans la fenêtre d'onboarding (aucune
///    candidature acceptée avec période de stage validée).
///
/// Le garde central (`appRouterProvider`) s'appuie sur cette valeur unique :
/// dossier incomplet → écran d'onboarding, dossier complet → écran d'onboarding
/// (verrouillé), `null` → accès accordé.
final documentOnboardingProvider =
    AsyncNotifierProvider<DocumentOnboardingNotifier, DocumentOnboarding?>(
  DocumentOnboardingNotifier.new,
  // Pas de reprise automatique : l'échec est affiché immédiatement et le
  // bouton « Réessayer » de l'écran d'onboarding rejoue la demande.
  retry: (retryCount, error) => null,
);

class DocumentOnboardingNotifier extends AsyncNotifier<DocumentOnboarding?> {
  @override
  Future<DocumentOnboarding?> build() async {
    final authState = await ref.watch(authProvider.future);
    final session = authState.session;
    if (session == null || session.user.role != 'CANDIDAT') return null;
    return ref.read(getOnboardingUseCaseProvider).call();
  }

  /// Recharge le dossier (bouton « Réessayer »).
  Future<void> refresh() async {
    final next = await AsyncValue.guard(
      () => ref.read(getOnboardingUseCaseProvider).call(),
    );
    state = next;
  }

  /// Dépose un document puis met à jour l'état du dossier.
  ///
  /// Relève les erreurs : l'appelant (l'écran) est responsable de l'affichage
  /// du message « Le document n'a pas pu être envoyé. » et de la reprise.
  Future<DocumentOnboarding> uploadDocument({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    final result = await ref.read(uploadOnboardingDocumentUseCaseProvider).call(
          candidatureId: candidatureId,
          type: type,
          filePath: filePath,
          fileName: fileName,
        );
    state = AsyncData(result);
    return result;
  }
}

/// Tentative de dépôt en échec, conservée pour le bouton « Réessayer ».
class OnboardingUploadAttempt {
  const OnboardingUploadAttempt({
    required this.candidatureId,
    required this.type,
    required this.filePath,
    this.fileName,
  });

  final String candidatureId;
  final String type;
  final String filePath;
  final String? fileName;
}

/// État d'interface du dépôt de documents (message d'erreur + reprise).
class OnboardingUploadUi {
  const OnboardingUploadUi({this.errorMessage, this.pendingAttempt});

  final String? errorMessage;
  final OnboardingUploadAttempt? pendingAttempt;

  bool get hasError => errorMessage != null && pendingAttempt != null;

  const OnboardingUploadUi.clear()
      : errorMessage = null,
        pendingAttempt = null;
}

final onboardingUploadUiProvider =
    NotifierProvider<OnboardingUploadUiNotifier, OnboardingUploadUi>(
  OnboardingUploadUiNotifier.new,
);

class OnboardingUploadUiNotifier extends Notifier<OnboardingUploadUi> {
  @override
  OnboardingUploadUi build() => const OnboardingUploadUi.clear();

  /// Enregistre l'échec du dépôt et conserve la tentative pour la reprise.
  void reportError(String message, OnboardingUploadAttempt attempt) {
    state = OnboardingUploadUi(errorMessage: message, pendingAttempt: attempt);
  }

  void clearError() {
    state = const OnboardingUploadUi.clear();
  }
}
