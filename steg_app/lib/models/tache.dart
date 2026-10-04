import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

enum TacheStatut {
  aFaire(value: 'A_FAIRE', label: 'À faire'),
  enCours(value: 'EN_COURS', label: 'En cours'),
  terminee(value: 'TERMINEE', label: 'Terminée'),
  bloquee(value: 'BLOQUEE', label: 'Bloquée');

  const TacheStatut({required this.value, required this.label});

  final String value;
  final String label;

  static TacheStatut? fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return null;
  }
}

enum TachePriorite {
  basse(value: 'BASSE', label: 'Basse'),
  moyenne(value: 'MOYENNE', label: 'Moyenne'),
  haute(value: 'HAUTE', label: 'Haute'),
  urgente(value: 'URGENTE', label: 'Urgente');

  const TachePriorite({required this.value, required this.label});

  final String value;
  final String label;

  static TachePriorite? fromValue(String? value) {
    for (final priorite in values) {
      if (priorite.value == value) return priorite;
    }
    return null;
  }
}

class Tache {
  const Tache({
    required this.id,
    required this.projetTitre,
    required this.createurNom,
    required this.createurPrenom,
    required this.titre,
    required this.description,
    required this.priorite,
    required this.statut,
    required this.progress,
    required this.estimatedHours,
    required this.spentHours,
    this.dateDebut,
    this.dateFin,
    this.createdAt,
  });

  factory Tache.fromJson(Map<String, dynamic> json) {
    return Tache(
      id: json['id']?.toString() ?? '',
      projetTitre: json['projet_titre'] as String? ?? '',
      createurNom: json['createur_nom'] as String? ?? '',
      createurPrenom: json['createur_prenom'] as String? ?? '',
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String? ?? '',
      priorite: json['priorite'] as String? ?? 'MOYENNE',
      statut: json['statut'] as String? ?? 'A_FAIRE',
      progress: numOrNull(json['progress'])?.toInt() ?? 0,
      dateDebut: parseDate(json['date_debut']),
      dateFin: parseDate(json['date_fin']),
      createdAt: parseDate(json['created_at']),
      estimatedHours: numOrNull(json['estimated_hours'])?.toInt() ?? 0,
      spentHours: numOrNull(json['spent_hours'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String projetTitre;
  final String createurNom;
  final String createurPrenom;
  final String titre;
  final String description;
  final String priorite;
  final String statut;
  final int progress;
  final DateTime? dateDebut;
  final DateTime? dateFin;
  final DateTime? createdAt;
  final int estimatedHours;
  final int spentHours;

  String get createurFullName => '${createurPrenom.trim()} ${createurNom.trim()}'.trim();

  bool get estEnRetard {
    if (statut == 'TERMINEE') return false;
    final fin = dateFin;
    if (fin == null) return false;
    return dateOnly(DateTime.now()).isAfter(dateOnly(fin));
  }

  String get echeanceLabel {
    final fin = dateFin;
    if (fin == null) return 'Sans échéance';
    return 'Échéance : ${formatDateFr(fin)}';
  }
}
