import '../core/utils/date_utils.dart';

enum JournalStatut {
  brouillon(value: 'BROUILLON', label: 'Brouillon'),
  soumis(value: 'SOUMIS', label: 'Soumis'),
  valide(value: 'VALIDE', label: 'Validé'),
  rejete(value: 'REJETE', label: 'Rejeté');

  const JournalStatut({required this.value, required this.label});

  final String value;
  final String label;

  static JournalStatut? fromValue(String? value) {
    for (final statut in values) {
      if (statut.value == value) return statut;
    }
    return null;
  }
}

class JournalEntry {
  const JournalEntry({
    required this.id,
    required this.stageId,
    this.semaine,
    required this.travaux,
    this.difficultes = '',
    this.solutions = '',
    this.competences = '',
    this.heures = 0,
    this.commentaire = '',
    required this.statut,
    this.commentaireEncadrant = '',
    this.dateSoumission,
    this.dateValidation,
    this.stagiaireNom = '',
    this.stagiairePrenom = '',
    this.encadrantNom = '',
    this.encadrantPrenom = '',
    this.offreTitre = '',
  });

  factory JournalEntry.fromJson(Map<String, dynamic> json) {
    return JournalEntry(
      id: json['id']?.toString() ?? '',
      stageId: json['stage_id']?.toString() ?? '',
      semaine: parseDate(json['semaine']),
      travaux: json['travaux'] as String? ?? '',
      difficultes: json['difficultes'] as String? ?? '',
      solutions: json['solutions'] as String? ?? '',
      competences: json['competences'] as String? ?? '',
      heures: double.tryParse(json['heures']?.toString() ?? '') ?? 0,
      commentaire: json['commentaire'] as String? ?? '',
      statut: JournalStatut.fromValue(json['statut']?.toString()) ??
          JournalStatut.brouillon,
      commentaireEncadrant: json['commentaire_encadrant'] as String? ?? '',
      dateSoumission: parseDate(json['date_soumission']),
      dateValidation: parseDate(json['date_validation']),
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
      offreTitre: json['offre_titre'] as String? ?? '',
    );
  }

  final String id;
  final String stageId;
  final DateTime? semaine;
  final String travaux;
  final String difficultes;
  final String solutions;
  final String competences;
  final double heures;
  final String commentaire;
  final JournalStatut statut;
  final String commentaireEncadrant;
  final DateTime? dateSoumission;
  final DateTime? dateValidation;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String encadrantNom;
  final String encadrantPrenom;
  final String offreTitre;

  String get stagiaireFullName =>
      '${stagiairePrenom.trim()} ${stagiaireNom.trim()}'.trim();

  String get encadrantFullName =>
      '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  String get semaineLabel => formatDateFr(semaine);

  String get semaineRangeLabel {
    final start = semaine;
    if (start == null) return 'Semaine —';
    final end = start.add(const Duration(days: 6));
    return 'Semaine du ${formatDateFr(start)} au ${formatDateFr(end)}';
  }

  String get heuresLabel =>
      heures == heures.roundToDouble() ? heures.toInt().toString() : heures.toString();

  bool get isEditable =>
      statut == JournalStatut.brouillon || statut == JournalStatut.rejete;
}

class JournalDraft {
  const JournalDraft({
    this.stageId,
    this.semaine,
    this.travaux = '',
    this.difficultes = '',
    this.solutions = '',
    this.competences = '',
    this.heures = 0,
    this.commentaire = '',
  });

  final String? stageId;
  final DateTime? semaine;
  final String travaux;
  final String difficultes;
  final String solutions;
  final String competences;
  final double heures;
  final String commentaire;

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'travaux': travaux,
      'difficultes': difficultes,
      'solutions': solutions,
      'competences': competences,
      'heures': heures,
      'commentaire': commentaire,
    };
    if (stageId != null) map['stage_id'] = stageId;
    if (semaine != null) {
      map['semaine'] = formatDateFr(semaine).split('/').reversed.join('-');
    }
    return map;
  }
}
