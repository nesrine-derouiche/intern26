import '../core/utils/json_utils.dart';
class PersonalTache {
  const PersonalTache({
    required this.id,
    required this.stagiaireId,
    required this.titre,
    this.description,
    required this.statut,
    this.priorite,
    this.dateEcheance,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
  });

  factory PersonalTache.fromJson(Map<String, dynamic> json) {
    return PersonalTache(
      id: json['id']?.toString() ?? '',
      stagiaireId: json['stagiaire_id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String?,
      statut: json['statut'] as String? ?? 'A_FAIRE',
      priorite: json['priorite'] as String?,
      dateEcheance: json['date_echeance'] as String?,
      position: numOrNull(json['position'])?.toInt() ?? 0,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  final String id;
  final String stagiaireId;
  final String titre;
  final String? description;
  final String statut;
  final String? priorite;
  final String? dateEcheance;
  final int position;
  final String createdAt;
  final String updatedAt;

  bool get isAFaire => statut == 'A_FAIRE';
  bool get isEnCours => statut == 'EN_COURS';
  bool get isTerminee => statut == 'TERMINEE';

  String get statutLabel {
    switch (statut) {
      case 'A_FAIRE':
        return 'À faire';
      case 'EN_COURS':
        return 'En cours';
      case 'TERMINEE':
        return 'Terminée';
      default:
        return statut;
    }
  }

  PersonalTache copyWith({
    String? statut,
    int? position,
    String? titre,
    String? description,
    String? priorite,
    String? dateEcheance,
  }) {
    return PersonalTache(
      id: id,
      stagiaireId: stagiaireId,
      titre: titre ?? this.titre,
      description: description ?? this.description,
      statut: statut ?? this.statut,
      priorite: priorite ?? this.priorite,
      dateEcheance: dateEcheance ?? this.dateEcheance,
      position: position ?? this.position,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

enum PersonalTacheStatut {
  aFaire(value: 'A_FAIRE', label: 'À faire'),
  enCours(value: 'EN_COURS', label: 'En cours'),
  terminee(value: 'TERMINEE', label: 'Terminée');

  const PersonalTacheStatut({required this.value, required this.label});
  final String value;
  final String label;
}
