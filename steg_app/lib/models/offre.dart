import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

class Offre {
  const Offre({
    required this.id,
    required this.titre,
    required this.description,
    required this.duree,
    required this.competencesDemandees,
    required this.nombrePlaces,
    required this.statut,
    required this.departementNom,
    required this.nbCandidatures,
    this.departementId,
    this.dateLimite,
  });

  factory Offre.fromJson(Map<String, dynamic> json) {
    return Offre(
      id: json['id']?.toString() ?? '',
      departementId: json['departement_id']?.toString(),
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String? ?? '',
      duree: numOrNull(json['duree'])?.toInt() ?? 0,
      competencesDemandees: json['competences_demandees'] as String? ?? '',
      nombrePlaces: numOrNull(json['nombre_places'])?.toInt() ?? 0,
      dateLimite: parseDate(json['date_limite']),
      statut: json['statut'] as String? ?? '',
      departementNom: json['departement_nom'] as String? ?? '',
      nbCandidatures: numOrNull(json['nb_candidatures'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String? departementId;
  final String titre;
  final String description;
  final int duree;
  final String competencesDemandees;
  final int nombrePlaces;
  final DateTime? dateLimite;
  final String statut;
  final String departementNom;
  final int nbCandidatures;

  bool get estOuverte => statut == 'OUVERTE';

  List<String> get competences {
    return competencesDemandees
        .split(RegExp(r'[,\n]'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  String get dureeLabel => duree == 1 ? '1 semaine' : '$duree semaines';
}
