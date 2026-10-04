class User {
  const User({
    required this.id,
    required this.nom,
    required this.prenom,
    required this.email,
    required this.role,
    this.telephone,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      nom: json['nom'] as String? ?? '',
      prenom: json['prenom'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? '',
      telephone: json['telephone'] as String?,
    );
  }

  final String id;
  final String nom;
  final String prenom;
  final String email;
  final String role;
  final String? telephone;

  String get fullName => '${prenom.trim()} ${nom.trim()}'.trim();

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nom': nom,
      'prenom': prenom,
      'email': email,
      'role': role,
      if (telephone != null) 'telephone': telephone,
    };
  }
}
