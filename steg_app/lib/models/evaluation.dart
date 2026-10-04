import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

class Evaluation {
  const Evaluation({
    required this.id,
    required this.stageId,
    required this.encadrantId,
    required this.technique,
    required this.communication,
    required this.autonomie,
    required this.ponctualite,
    required this.qualite,
    required this.noteFinale,
    required this.commentaire,
    required this.dateEvaluation,
    required this.validee,
    this.stagiaireNom = '',
    this.stagiairePrenom = '',
    this.encadrantNom = '',
    this.encadrantPrenom = '',
  });

  factory Evaluation.fromJson(Map<String, dynamic> json) {
    return Evaluation(
      id: json['id']?.toString() ?? '',
      stageId: json['stage_id']?.toString() ?? '',
      encadrantId: json['encadrant_id']?.toString() ?? '',
      technique: numOrNull(json['technique'])?.toInt() ?? 0,
      communication: numOrNull(json['communication'])?.toInt() ?? 0,
      autonomie: numOrNull(json['autonomie'])?.toInt() ?? 0,
      ponctualite: numOrNull(json['ponctualite'])?.toInt() ?? 0,
      qualite: numOrNull(json['qualite'])?.toInt() ?? 0,
      noteFinale: double.tryParse(json['note_finale']?.toString() ?? '') ?? 0,
      commentaire: json['commentaire'] as String? ?? '',
      dateEvaluation: parseDate(json['date_evaluation']),
      validee: json['validee'] as bool? ?? true,
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
    );
  }

  final String id;
  final String stageId;
  final String encadrantId;
  final int technique;
  final int communication;
  final int autonomie;
  final int ponctualite;
  final int qualite;
  final double noteFinale;
  final String commentaire;
  final DateTime? dateEvaluation;
  final bool validee;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String encadrantNom;
  final String encadrantPrenom;

  String get encadrantFullName =>
      '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  String get noteLabel => noteFinale.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
}
