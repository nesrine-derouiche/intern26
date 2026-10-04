import '../core/utils/date_utils.dart';

class Candidature {
  const Candidature({
    required this.id,
    required this.stagiaireId,
    required this.offreId,
    required this.statut,
    required this.stagiaireNom,
    required this.stagiairePrenom,
    required this.offreTitre,
    required this.departementNom,
    this.dateCandidature,
  });

  factory Candidature.fromJson(Map<String, dynamic> json) {
    return Candidature(
      id: json['id']?.toString() ?? '',
      stagiaireId: json['stagiaire_id']?.toString() ?? '',
      offreId: json['offre_id']?.toString() ?? '',
      dateCandidature: parseDate(json['date_candidature']),
      statut: json['statut'] as String? ?? '',
      stagiaireNom: json['stagiaire_nom'] as String? ?? '',
      stagiairePrenom: json['stagiaire_prenom'] as String? ?? '',
      offreTitre: json['offre_titre'] as String? ?? '',
      departementNom: json['departement_nom'] as String? ?? '',
    );
  }

  final String id;
  final String stagiaireId;
  final String offreId;
  final DateTime? dateCandidature;
  final String statut;
  final String stagiaireNom;
  final String stagiairePrenom;
  final String offreTitre;
  final String departementNom;

  String get stagiaireFullName => '${stagiairePrenom.trim()} ${stagiaireNom.trim()}'.trim();
}
