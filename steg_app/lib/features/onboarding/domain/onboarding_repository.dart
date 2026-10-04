import '../../../models/document_onboarding.dart';
import '../../../models/internship_access.dart';

abstract interface class OnboardingRepository {
  /// État du dossier de candidature du candidat connecté.
  ///
  /// `null` quand le candidat n'est pas dans la fenêtre d'onboarding.
  Future<DocumentOnboarding?> getOnboarding();

  /// Dépose un document du dossier (CV, CIN, DEMANDE_STAGE, LETTRE_AFFECTATION)
  /// et retourne l'état mis à jour du dossier.
  Future<DocumentOnboarding> uploadDocument({
    required String candidatureId,
    required String type,
    required String filePath,
    String? fileName,
  });

  /// Verdict d'accès au stage après vérification du dossier du candidat.
  Future<InternshipAccess> getInternshipAccess(String candidatureId);
}
