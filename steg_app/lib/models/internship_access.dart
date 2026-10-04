import 'document_onboarding.dart';

/// Verdict d'accès au stage renvoyé par le backend après vérification du dossier.
class InternshipAccess {
  const InternshipAccess({
    required this.accessGranted,
    required this.documents,
  });

  factory InternshipAccess.fromJson(Map<String, dynamic> json) {
    return InternshipAccess(
      accessGranted: json['access_granted'] == true,
      documents: (json['documents'] as Map<String, dynamic>? ?? const {})
          .map((key, value) => MapEntry(key, value?.toString() ?? '')),
    );
  }

  /// `true` quand l'accès au stage est accordé (les 4 documents sont VALID).
  final bool accessGranted;

  /// Statut effectif de chaque document, clé = type (cv, cin, demande_stage,
  /// lettre_affectation) — MANQUANT, EN_ATTENTE, VERIFICATION, VALID,
  /// REVIEW_REQUIRED, REJECTED.
  final Map<String, String> documents;

  /// Statut effectif (enum) d'un type de document du dossier.
  OnboardingDocumentStatus? effectiveStatus(OnboardingDocumentType type) {
    final value = documents[type.value.toLowerCase()];
    if (value == null) return null;
    if (value == 'VALID') return OnboardingDocumentStatus.valide;
    return OnboardingDocumentStatus.fromValue(value) ??
        OnboardingDocumentStatus.manquant;
  }

  bool get allValid =>
      documents.length == OnboardingDocumentType.values.length &&
      documents.values.every((status) => status == 'VALID');
}
