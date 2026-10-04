import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/onboarding/domain/usecases/get_internship_access_usecase.dart';
import '../../models/internship_access.dart';
import '../auth/auth_provider.dart';
import 'document_onboarding_provider.dart';

final getInternshipAccessUseCaseProvider = Provider<GetInternshipAccessUseCase>(
  (ref) => GetInternshipAccessUseCase(ref.watch(onboardingRepositoryProvider)),
);

/// Verdict d'accès au stage du candidat connecté.
///
/// `null` quand :
///  - l'utilisateur n'est pas un candidat,
///  - le candidat n'est pas dans la fenêtre d'onboarding (aucun dossier en
///    cours : l'accès est alors ouvert, décidé par le garde central).
///
/// Le garde central (`appRouterProvider`) s'appuie sur `accessGranted` pour
/// autoriser l'accès à l'application ou le verrouiller sur l'onboarding.
final internshipAccessProvider =
    AsyncNotifierProvider<InternshipAccessNotifier, InternshipAccess?>(
  InternshipAccessNotifier.new,
  retry: (retryCount, error) => null,
);

class InternshipAccessNotifier extends AsyncNotifier<InternshipAccess?> {
  @override
  Future<InternshipAccess?> build() async {
    final authState = await ref.watch(authProvider.future);
    final session = authState.session;
    if (session == null || session.user.role != 'CANDIDAT') return null;
    final onboarding = await ref.watch(documentOnboardingProvider.future);
    if (onboarding == null) return null;
    return ref
        .read(getInternshipAccessUseCaseProvider)
        .call(onboarding.candidatureId);
  }

  /// Rejoue la demande de vérification (bouton « Réessayer »).
  Future<void> refresh() async {
    final next = await AsyncValue.guard(
      () async {
        final onboarding = await ref.read(documentOnboardingProvider.future);
        if (onboarding == null) return null;
        return ref
            .read(getInternshipAccessUseCaseProvider)
            .call(onboarding.candidatureId);
      },
    );
    state = next;
  }
}
