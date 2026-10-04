import '../core/utils/date_utils.dart';

class Reunion {
  const Reunion({
    required this.id,
    required this.stageId,
    required this.sujet,
    required this.date,
    required this.heure,
    required this.encadrantNom,
    required this.encadrantPrenom,
    this.salle,
    this.lienVisio,
    this.stagiaireNom = '',
    this.stagiairePrenom = '',
  });

  factory Reunion.fromJson(Map<String, dynamic> json) {
    return Reunion(
      id: json['id']?.toString() ?? '',
      stageId: json['stage_id']?.toString() ?? '',
      sujet: json['sujet'] as String? ?? '',
      date: parseDate(json['date']),
      heure: json['heure'] as String? ?? '',
      salle: json['salle'] as String?,
      lienVisio: json['lien_visio'] as String?,
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
    );
  }

  final String id;
  final String stageId;
  final String sujet;
  final DateTime? date;
  final String heure;
  final String? salle;
  final String? lienVisio;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String encadrantNom;
  final String encadrantPrenom;

  String get encadrantFullName => '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  String get heureLabel => formatTimeFr(heure);

  bool get estAVenir {
    final d = date;
    if (d == null) return false;
    return !dateOnly(DateTime.now()).isAfter(dateOnly(d));
  }
}
