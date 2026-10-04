import '../core/utils/date_utils.dart';

enum StageStatut {
  enCours(value: 'EN_COURS', label: 'En cours'),
  termine(value: 'TERMINE', label: 'Terminé'),
  suspendu(value: 'SUSPENDU', label: 'Suspendu'),
  annule(value: 'ANNULE', label: 'Annulé'),
  enAttente(value: 'EN_ATTENTE', label: 'En attente');

  const StageStatut({required this.value, required this.label});

  final String value;
  final String label;

  static StageStatut? fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return null;
  }
}

class Internship {
  const Internship({
    required this.id,
    required this.dateDebut,
    required this.dateFin,
    required this.statut,
    required this.stagiaireNom,
    required this.stagiairePrenom,
    required this.encadrantNom,
    required this.encadrantPrenom,
    required this.departementNom,
    required this.offreTitre,
  });

  factory Internship.fromJson(Map<String, dynamic> json) {
    return Internship(
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

  bool get isActive => statut == 'EN_COURS';

  String get titre => offreTitre.isEmpty ? 'Stage' : offreTitre;

  String get encadrantFullName => '${encadrantPrenom.trim()} ${encadrantNom.trim()}'.trim();

  int get dureeSemaines {
    final start = dateDebut;
    final end = dateFin;
    if (start == null || end == null) return 0;
    return (end.difference(start).inDays / 7).round();
  }

  String get periodeLabel {
    final start = dateDebut;
    final end = dateFin;
    if (start == null || end == null) return '—';
    return 'Du ${formatDateFr(start)} au ${formatDateFr(end)}';
  }

  int get progress {
    if (statut == 'TERMINE') return 100;
    final start = dateDebut;
    final end = dateFin;
    if (start == null || end == null) return 0;
    final total = end.difference(start).inDays;
    if (total <= 0) return 0;
    final elapsed = dateOnly(DateTime.now()).difference(dateOnly(start)).inDays;
    return (elapsed / total * 100).clamp(0, 100).round();
  }
}
