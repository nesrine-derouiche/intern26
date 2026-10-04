import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

enum PointageStatut {
  present(value: 'PRESENT', label: 'Présent'),
  retard(value: 'RETARD', label: 'Retard'),
  absent(value: 'ABSENT', label: 'Absent');

  const PointageStatut({required this.value, required this.label});

  final String value;
  final String label;

  static PointageStatut? fromValue(String? value) {
    for (final s in values) {
      if (s.value == value) return s;
    }
    return null;
  }
}

class Pointage {
  const Pointage({
    required this.id,
    required this.stageId,
    required this.datePointage,
    this.heureEntree,
    this.heureSortie,
    this.dureeMinutes,
    required this.retardMinutes,
    required this.statut,
    this.commentaire,
    required this.createdAt,
    required this.updatedAt,
    this.stagiaireNom = '',
    this.stagiairePrenom = '',
    this.encadrantNom = '',
    this.encadrantPrenom = '',
    this.departementNom = '',
  });

  factory Pointage.fromJson(Map<String, dynamic> json) {
    return Pointage(
      id: json['id']?.toString() ?? '',
      stageId: json['stage_id']?.toString() ?? '',
      datePointage: parseDate(json['date_pointage']),
      heureEntree: json['heure_entree'] as String?,
      heureSortie: json['heure_sortie'] as String?,
      dureeMinutes: numOrNull(json['duree_minutes'])?.toInt(),
      retardMinutes: numOrNull(json['retard_minutes'])?.toInt() ?? 0,
      statut: PointageStatut.fromValue(json['statut']?.toString()) ??
          PointageStatut.present,
      commentaire: json['commentaire'] as String?,
      createdAt: parseDate(json['created_at']),
      updatedAt: parseDate(json['updated_at']),
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      encadrantNom: json['encadrant_nom'] as String? ?? '',
      encadrantPrenom: json['encadrant_prenom'] as String? ?? '',
      departementNom: json['departement_nom'] as String? ?? '',
    );
  }

  final String id;
  final String stageId;
  final DateTime? datePointage;
  final String? heureEntree;
  final String? heureSortie;
  final int? dureeMinutes;
  final int retardMinutes;
  final PointageStatut statut;
  final String? commentaire;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String encadrantNom;
  final String encadrantPrenom;
  final String departementNom;

  String get stagiaireFullName =>
      '${stagiairePrenom.trim()} ${stagiaireNom.trim()}'.trim();

  bool get hasEntry => heureEntree != null && heureEntree!.isNotEmpty;
  bool get hasExit => heureSortie != null && heureSortie!.isNotEmpty;
  bool get isJourneeTerminee => hasEntry && hasExit;

  String get heureEntreeLabel => formatTimeFr(heureEntree);
  String get heureSortieLabel => formatTimeFr(heureSortie);

  String get dureeLabel {
    if (dureeMinutes == null) return '—';
    final h = dureeMinutes! ~/ 60;
    final m = dureeMinutes! % 60;
    if (h == 0) return '${m}min';
    if (m == 0) return '${h}h';
    return '${h}h${m.toString().padLeft(2, '0')}';
  }

  String get retardLabel {
    if (retardMinutes <= 0) return '';
    return '+${retardMinutes}min';
  }

  String get statutLabel => statut.label;

  String get dateLabel => formatDateFr(datePointage);
}

class Horaire {
  const Horaire({
    required this.heureDebut,
    required this.heureFin,
    required this.dureePauseMinutes,
  });

  factory Horaire.fromJson(Map<String, dynamic> json) {
    return Horaire(
      heureDebut: json['heure_debut'] as String? ?? '09:00',
      heureFin: json['heure_fin'] as String? ?? '17:00',
      dureePauseMinutes: numOrNull(json['duree_pause_minutes'])?.toInt() ?? 60,
    );
  }

  final String heureDebut;
  final String heureFin;
  final int dureePauseMinutes;

  String get horaireLabel => '${formatTimeFr(heureDebut)} — ${formatTimeFr(heureFin)}';

  String get pauseLabel => 'Pause : ${dureePauseMinutes}min';
}

class PointageStats {
  const PointageStats({
    required this.totalJours,
    required this.presents,
    required this.retards,
    required this.absents,
    required this.totalMinutes,
    required this.moyenneMinutes,
    required this.totalRetardMinutes,
  });

  factory PointageStats.fromJson(Map<String, dynamic> json) {
    return PointageStats(
      totalJours: numOrNull(json['total_jours'])?.toInt() ?? 0,
      presents: numOrNull(json['presents'])?.toInt() ?? 0,
      retards: numOrNull(json['retards'])?.toInt() ?? 0,
      absents: numOrNull(json['absents'])?.toInt() ?? 0,
      totalMinutes: numOrNull(json['total_minutes'])?.toInt() ?? 0,
      moyenneMinutes: numOrNull(json['moyenne_minutes'])?.toDouble() ?? 0,
      totalRetardMinutes: numOrNull(json['total_retard_minutes'])?.toInt() ?? 0,
    );
  }

  final int totalJours;
  final int presents;
  final int retards;
  final int absents;
  final int totalMinutes;
  final double moyenneMinutes;
  final int totalRetardMinutes;

  String get totalHeuresLabel {
    final h = totalMinutes ~/ 60;
    final m = totalMinutes % 60;
    return '${h}h${m.toString().padLeft(2, '0')}';
  }

  double get tauxPresence =>
      totalJours > 0 ? (presents / totalJours * 100) : 0;
}
