import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

class CompletionData {
  const CompletionData({
    required this.stage,
    required this.evaluation,
    required this.isCompleted,
    this.completionDate,
    required this.availableDocuments,
  });

  factory CompletionData.fromJson(Map<String, dynamic> json) {
    final stageJson = json['stage'] as Map<String, dynamic>?;
    final evalJson = json['evaluation'] as Map<String, dynamic>?;
    final docs = (json['available_documents'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        const [];

    return CompletionData(
      stage: stageJson != null ? CompletionStage.fromJson(stageJson) : null,
      evaluation: evalJson != null ? CompletionEvaluation.fromJson(evalJson) : null,
      isCompleted: json['is_completed'] as bool? ?? false,
      completionDate: parseDate(json['completion_date']),
      availableDocuments: docs,
    );
  }

  final CompletionStage? stage;
  final CompletionEvaluation? evaluation;
  final bool isCompleted;
  final DateTime? completionDate;
  final List<String> availableDocuments;

  bool get hasEvaluation => evaluation != null;
  double get noteFinale => evaluation?.noteFinale ?? 0;
  String get noteLabel => noteFinale.toStringAsFixed(2);
  String get statusLabel => isCompleted ? 'Terminé' : 'En cours';
}

class CompletionStage {
  const CompletionStage({
    required this.id,
    this.dateDebut,
    this.dateFin,
    required this.statut,
    required this.stagiaireNom,
    required this.stagiairePrenom,
    required this.encadrantNom,
    required this.encadrantPrenom,
    required this.departementNom,
    required this.offreTitre,
  });

  factory CompletionStage.fromJson(Map<String, dynamic> json) {
    return CompletionStage(
      id: json['id']?.toString() ?? '',
      dateDebut: parseDate(json['date_debut']),
      dateFin: parseDate(json['date_fin']),
      statut: json['statut'] as String? ?? '',
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
      departementNom: json['departement_nom'] as String? ?? '',
      offreTitre: json['offre_titre'] as String? ?? '',
    );
  }

  final String id;
  final DateTime? dateDebut;
  final DateTime? dateFin;
  final String statut;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String encadrantNom;
  final String encadrantPrenom;
  final String departementNom;
  final String offreTitre;

  String get encadrantFullName =>
      '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  String get periodeLabel {
    final start = dateDebut;
    final end = dateFin;
    if (start == null || end == null) return '—';
    return 'Du ${formatDateFr(start)} au ${formatDateFr(end)}';
  }
}

class CompletionEvaluation {
  const CompletionEvaluation({
    required this.id,
    required this.technique,
    required this.communication,
    required this.autonomie,
    required this.ponctualite,
    required this.qualite,
    required this.noteFinale,
    this.commentaire,
    this.dateEvaluation,
    required this.validee,
    this.encadrantNom = '',
    this.encadrantPrenom = '',
  });

  factory CompletionEvaluation.fromJson(Map<String, dynamic> json) {
    return CompletionEvaluation(
      id: json['id']?.toString() ?? '',
      technique: numOrNull(json['technique'])?.toInt() ?? 0,
      communication: numOrNull(json['communication'])?.toInt() ?? 0,
      autonomie: numOrNull(json['autonomie'])?.toInt() ?? 0,
      ponctualite: numOrNull(json['ponctualite'])?.toInt() ?? 0,
      qualite: numOrNull(json['qualite'])?.toInt() ?? 0,
      noteFinale: double.tryParse(json['note_finale']?.toString() ?? '') ?? 0,
      commentaire: json['commentaire'] as String?,
      dateEvaluation: parseDate(json['date_evaluation']),
      validee: json['validee'] as bool? ?? true,
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
    );
  }

  final String id;
  final int technique;
  final int communication;
  final int autonomie;
  final int ponctualite;
  final int qualite;
  final double noteFinale;
  final String? commentaire;
  final DateTime? dateEvaluation;
  final bool validee;
  final String encadrantNom;
  final String encadrantPrenom;

  String get encadrantFullName =>
      '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  String get noteLabel =>
      noteFinale.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
}
