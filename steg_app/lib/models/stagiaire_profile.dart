import 'internship.dart';

class StagiaireProfile {
  const StagiaireProfile({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.email,
    this.telephone,
    this.ecole,
    this.specialite,
    this.niveau,
    this.competences,
    this.disponibilite = true,
    required this.stages,
  });

  factory StagiaireProfile.fromJson(Map<String, dynamic> json) {
    final stages = (json['stages'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(Internship.fromJson)
        .toList();
    return StagiaireProfile(
      id: json['id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      email: json['email'] as String? ?? '',
      telephone: json['telephone'] as String?,
      ecole: json['ecole'] as String?,
      specialite: json['specialite'] as String?,
      niveau: json['niveau'] as String?,
      competences: json['competences'] as String?,
      disponibilite: json['disponibilite'] as bool? ?? true,
      stages: stages,
    );
  }

  final String id;
  final String nom;
  final String prenom;
  final String email;
  final String? telephone;
  final String? ecole;
  final String? specialite;
  final String? niveau;
  final String? competences;
  final bool disponibilite;
  final List<Internship> stages;

  String get fullName => '${prenom.trim()} ${nom.trim()}'.trim();

  Internship? get activeStage {
    for (final stage in stages) {
      if (stage.isActive) return stage;
    }
    return stages.isEmpty ? null : stages.first;
  }

  String? get departementNom {
    final nom = activeStage?.departementNom;
    if (nom == null || nom.isEmpty) return null;
    return nom;
  }

  String? get encadrantFullName {
    final nom = activeStage?.encadrantFullName;
    if (nom == null || nom.isEmpty) return null;
    return nom;
  }

  List<String> get skills {
    final raw = competences;
    if (raw == null || raw.trim().isEmpty) return const [];
    return raw
        .split(RegExp(r'[,;\n]+'))
        .map((skill) => skill.trim())
        .where((skill) => skill.isNotEmpty)
        .toList();
  }
}
