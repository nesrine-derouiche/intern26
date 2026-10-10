import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

class CertificationDocument {
  const CertificationDocument({
    required this.id,
    required this.kind,
    required this.version,
    required this.nom,
    this.taille,
    this.createdAt,
  });

  factory CertificationDocument.fromJson(Map<String, dynamic> json) {
    return CertificationDocument(
      id: json['id']?.toString() ?? '',
      kind: json['kind'] as String? ?? '',
      version: numOrNull(json['version'])?.toInt() ?? 1,
      nom: json['nom'] as String? ?? '',
      taille: numOrNull(json['taille'])?.toInt(),
      createdAt: parseDate(json['created_at']),
    );
  }

  final String id;
  final String kind;
  final int version;
  final String nom;
  final int? taille;
  final DateTime? createdAt;

  String get formattedTaille {
    final bytes = taille;
    if (bytes == null) return '—';
    if (bytes < 1024) return '$bytes o';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} Ko';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} Mo';
  }
}

class CertificationDecision {
  const CertificationDecision({
    required this.fromStatut,
    required this.toStatut,
    this.reason,
    this.documentConcerne,
    this.createdAt,
  });

  factory CertificationDecision.fromJson(Map<String, dynamic> json) {
    return CertificationDecision(
      fromStatut: json['from_statut'] as String? ?? '',
      toStatut: json['to_statut'] as String? ?? '',
      reason: json['reason'] as String?,
      documentConcerne: json['document_concerne'] as String?,
      createdAt: parseDate(json['created_at']),
    );
  }

  final String fromStatut;
  final String toStatut;
  final String? reason;
  final String? documentConcerne;
  final DateTime? createdAt;
}

class CertificationState {
  const CertificationState({
    required this.statut,
    this.submittedAt,
    this.decidedAt,
    this.reviewerId,
    this.reason,
    this.documentConcerne,
    this.journal,
    this.rapport,
    this.hasAttestation = false,
    this.attestationNom,
    this.versions = const [],
    this.decisions = const [],
  });

  factory CertificationState.fromJson(Map<String, dynamic> json) {
    CertificationDocument? parseDoc(Object? value) {
      if (value is Map<String, dynamic>) {
        return CertificationDocument.fromJson(value);
      }
      return null;
    }

    final documents = json['documents'];
    final versions = json['versions'];
    final decisions = json['decisions'];
    final certification = json['certification'];
    final certMap =
        certification is Map<String, dynamic> ? certification : null;
    return CertificationState(
      statut: json['statut'] as String? ?? 'NOT_SUBMITTED',
      submittedAt: parseDate(certMap?['submitted_at']),
      decidedAt: parseDate(certMap?['decided_at']),
      reviewerId: certMap?['reviewer_id']?.toString(),
      reason: certMap?['reason'] as String?,
      documentConcerne: certMap?['document_concerne'] as String?,
      journal: documents is Map ? parseDoc(documents['JOURNAL']) : null,
      rapport: documents is Map ? parseDoc(documents['RAPPORT']) : null,
      hasAttestation: certMap?['has_attestation'] == true,
      attestationNom: certMap?['attestation_nom'] as String?,
      versions: versions is List
          ? versions
              .whereType<Map<String, dynamic>>()
              .map(CertificationDocument.fromJson)
              .toList()
          : const [],
      decisions: decisions is List
          ? decisions
              .whereType<Map<String, dynamic>>()
              .map(CertificationDecision.fromJson)
              .toList()
          : const [],
    );
  }

  final String statut;
  final DateTime? submittedAt;
  final DateTime? decidedAt;
  final String? reviewerId;
  final String? reason;
  final String? documentConcerne;
  final CertificationDocument? journal;
  final CertificationDocument? rapport;
  final bool hasAttestation;
  final String? attestationNom;
  final List<CertificationDocument> versions;
  final List<CertificationDecision> decisions;

  bool get isSubmitted => statut == 'SUBMITTED';
  bool get isValidated => statut == 'VALIDATED';
  bool get isDenied => statut == 'DENIED';
  bool get isRedoRequested => statut == 'REDO_REQUESTED';
  bool get canUpload =>
      statut == 'NOT_SUBMITTED' ||
      statut == 'REDO_REQUESTED' ||
      statut == 'DENIED';
  bool get canSubmit =>
      statut == 'NOT_SUBMITTED' ||
      statut == 'REDO_REQUESTED' ||
      statut == 'DENIED';
  bool get hasBothDocuments => journal != null && rapport != null;
  bool get canConfirm => canSubmit && hasBothDocuments;
  bool get isCertificateGenerated => statut == 'CERTIFICATE_GENERATED';
}
