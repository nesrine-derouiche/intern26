import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

enum DocumentType {
  cv(value: 'CV', label: 'CV'),
  convention(value: 'CONVENTION', label: 'Convention'),
  assurance(value: 'ASSURANCE', label: 'Assurance'),
  rapport(value: 'RAPPORT', label: 'Rapport'),
  attestation(value: 'ATTESTATION', label: 'Attestation');

  const DocumentType({required this.value, required this.label});

  final String value;
  final String label;

  static DocumentType? fromValue(String? value) {
    for (final type in values) {
      if (type.value == value) return type;
    }
    return null;
  }
}

class DocumentItem {
  const DocumentItem({
    required this.id,
    required this.stageId,
    required this.type,
    required this.nom,
    required this.chemin,
    required this.dateDepot,
    this.stagiaireNom = '',
    this.stagiairePrenom = '',
    this.templateVersion,
  });

  factory DocumentItem.fromJson(Map<String, dynamic> json) {
    return DocumentItem(
      id: json['id']?.toString() ?? '',
      stageId: json['stage_id']?.toString() ?? '',
      type: json['type'] as String? ?? '',
      nom: json['nom'] as String? ?? '',
      chemin: json['chemin']?.toString() ?? '',
      dateDepot: parseDate(json['date_depot']),
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      templateVersion: numOrNull(json['template_version'])?.toInt(),
    );
  }

  final String id;
  final String stageId;
  final String type;
  final String nom;
  final String chemin;
  final DateTime? dateDepot;
  final String stagiaireNom;
  final String stagiairePrenom;
  final int? templateVersion;

  String get typeLabel {
    final parsed = DocumentType.fromValue(type);
    return parsed?.label ?? (type.isEmpty ? 'Document' : type);
  }

  String get extension {
    final dot = nom.lastIndexOf('.');
    if (dot < 0 || dot == nom.length - 1) return '';
    return nom.substring(dot + 1).toUpperCase();
  }
}
