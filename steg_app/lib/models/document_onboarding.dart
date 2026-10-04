import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

/// Documents requis du dossier de candidature (onboarding pré-stage).
enum OnboardingDocumentType {
  cv(
    value: 'CV',
    label: 'CV',
    hint: 'Votre curriculum vitae à jour',
  ),
  cin(
    value: 'CIN',
    label: 'Carte d\'identité (CIN)',
    hint: 'Recto verso de votre carte d\'identité nationale',
  ),
  demandeStage(
    value: 'DEMANDE_STAGE',
    label: 'Demande de stage',
    hint: 'Lettre de demande de stage adressée à la STEG',
  ),
  lettreAffectation(
    value: 'LETTRE_AFFECTATION',
    label: 'Lettre d\'affectation',
    hint: 'Lettre d\'affectation de l\'établissement',
  );

  const OnboardingDocumentType({
    required this.value,
    required this.label,
    required this.hint,
  });

  final String value;
  final String label;
  final String hint;

  static OnboardingDocumentType? fromValue(String? value) {
    for (final type in values) {
      if (type.value == value) return type;
    }
    return null;
  }
}

/// Statut d'un document du dossier de candidature.
///
/// `verification` et `reviewRequired` correspondent au verdict de la
/// vérification automatique (`verification_status` côté backend).
enum OnboardingDocumentStatus {
  manquant(value: 'MANQUANT', label: 'Document manquant'),
  enAttente(value: 'EN_ATTENTE', label: 'Document envoyé'),
  verification(value: 'VERIFICATION', label: 'Vérification en cours'),
  valide(value: 'VALIDE', label: 'Document validé'),
  reviewRequired(
    value: 'REVIEW_REQUIRED',
    label: 'Document nécessitant une vérification',
  ),
  rejete(value: 'REJETE', label: 'Document rejeté');

  const OnboardingDocumentStatus({required this.value, required this.label});

  final String value;
  final String label;

  static OnboardingDocumentStatus? fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return null;
  }

  /// Statut effectif d'un document, identique au calcul backend.
  ///
  /// Priorité : rejet (statut `REJETE` ou vérification `REJECTED`) >
  /// vérification manuelle (`REVIEW_REQUIRED`) > en cours (`PENDING`) >
  /// validé (`VALIDE`/`VALID` ou vérification `VALID`) > envoyé (`EN_ATTENTE`).
  /// `MANQUANT` quand aucune ligne n'existe.
  static OnboardingDocumentStatus effective(String? statut, String? verification) {
    final s = fromValue(statut);
    if (s == OnboardingDocumentStatus.rejete || verification == 'REJECTED') {
      return OnboardingDocumentStatus.rejete;
    }
    if (verification == 'REVIEW_REQUIRED') {
      return OnboardingDocumentStatus.reviewRequired;
    }
    if (verification == 'PENDING') {
      return OnboardingDocumentStatus.verification;
    }
    if (verification == 'VALID' ||
        s == OnboardingDocumentStatus.valide ||
        statut == 'VALID') {
      return OnboardingDocumentStatus.valide;
    }
    return s ?? OnboardingDocumentStatus.manquant;
  }
}

/// Un document du dossier de candidature.
class OnboardingDocument {
  const OnboardingDocument({
    required this.type,
    required this.status,
    this.nom,
    this.dateDepot,
    this.fromApplication = false,
    this.rejectedReason,
    this.verificationStatus,
  });

  factory OnboardingDocument.fromJson(Map<String, dynamic> json) {
    final statut = json['statut']?.toString();
    final verification = json['verification_status']?.toString();
    return OnboardingDocument(
      type: json['type']?.toString() ?? '',
      status: OnboardingDocumentStatus.effective(statut, verification),
      nom: json['nom'] as String?,
      dateDepot: parseDate(json['date_depot']),
      fromApplication: json['from_application'] == true,
      rejectedReason: json['rejected_reason'] as String?,
      verificationStatus: verification,
    );
  }

  final String type;
  final OnboardingDocumentStatus status;
  final String? nom;
  final DateTime? dateDepot;
  final bool fromApplication;
  final String? rejectedReason;

  /// Verdict brut de la vérification automatique (PENDING, VALID,
  /// REVIEW_REQUIRED, REJECTED) ; `null` quand le document n'a pas encore été
  /// vérifié automatiquement.
  final String? verificationStatus;

  bool get isSubmitted => status != OnboardingDocumentStatus.manquant;

  OnboardingDocumentType? get typeEnum => OnboardingDocumentType.fromValue(type);
}

/// État du dossier de candidature renvoyé par le backend.
class DocumentOnboarding {
  const DocumentOnboarding({
    required this.candidatureId,
    required this.requiredTypes,
    required this.documents,
    required this.submitted,
    required this.total,
  });

  factory DocumentOnboarding.fromJson(Map<String, dynamic> json) {
    final requiredTypes = (json['required_types'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList();
    final documents = (json['documents'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(OnboardingDocument.fromJson)
        .toList();
    final total = numOrNull(json['total'])?.toInt() ?? requiredTypes.length;
    return DocumentOnboarding(
      candidatureId: json['candidature_id']?.toString() ?? '',
      requiredTypes: requiredTypes,
      documents: documents,
      submitted: numOrNull(json['submitted'])?.toInt() ??
          documents.where((d) => d.isSubmitted).length,
      total: total,
    );
  }

  final String candidatureId;
  final List<String> requiredTypes;
  final List<OnboardingDocument> documents;
  final int submitted;
  final int total;

  bool get isComplete => total > 0 && submitted >= total;

  int get missingCount => total - submitted;

  OnboardingDocument? documentOfType(String type) {
    for (final document in documents) {
      if (document.type == type) return document;
    }
    return null;
  }
}
