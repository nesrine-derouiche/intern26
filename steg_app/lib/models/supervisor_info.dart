import '../core/utils/json_utils.dart';
class SupervisorSummary {
  const SupervisorSummary({
    required this.encadrantId,
    required this.nom,
    required this.prenom,
    required this.nbStages,
    required this.nbActifs,
  });

  factory SupervisorSummary.fromJson(Map<String, dynamic> json) {
    return SupervisorSummary(
      encadrantId: json['encadrant_id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      nbStages: numOrNull(json['nb_stages'])?.toInt() ?? 0,
      nbActifs: numOrNull(json['nb_actifs'])?.toInt() ?? 0,
    );
  }

  final String encadrantId;
  final String nom;
  final String prenom;
  final int nbStages;
  final int nbActifs;

  String get fullName => '${prenom.trim()} ${nom.trim()}'.trim();
}

class SupervisorInfo {
  const SupervisorInfo({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.nbStagiairesActifs,
    this.email,
    this.telephone,
    this.service,
    this.competences,
    this.departementNom,
  });

  factory SupervisorInfo.fromJson(Map<String, dynamic> json) {
    return SupervisorInfo(
      id: json['id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      email: json['email'] as String?,
      telephone: json['telephone'] as String?,
      service: json['service'] as String?,
      competences: json['competences'] as String?,
      departementNom: json['departement_nom'] as String?,
      nbStagiairesActifs: numOrNull(json['nb_stagiaires_actifs'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String nom;
  final String prenom;
  final String? email;
  final String? telephone;
  final String? service;
  final String? competences;
  final String? departementNom;
  final int nbStagiairesActifs;

  String get fullName => '${prenom.trim()} ${nom.trim()}'.trim();
}
