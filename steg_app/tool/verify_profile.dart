import 'dart:io';

import 'package:dio/dio.dart';

const baseUrl = 'http://localhost:3000/api';

Future<void> main() async {
  final dio = Dio(
    BaseOptions(baseUrl: baseUrl, contentType: 'application/json'),
  );

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await dio.post<Map<String, dynamic>>('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return res.data!;
  }

  int check(bool condition, String label) {
    stdout.writeln('${condition ? 'OK ' : 'FAIL'} $label');
    return condition ? 0 : 1;
  }

  var failures = 0;

  stdout.writeln('== Stagiaire login ==');
  final stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');
  failures += check(stagiaire['token'] != null, 'stagiaire login returns token');
  final api = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      contentType: 'application/json',
      headers: {'Authorization': 'Bearer ${stagiaire['token']}'},
    ),
  );

  stdout.writeln('== GET /stagiaires/:id ==');
  final profile = (await api.get<Map<String, dynamic>>(
    '/stagiaires/${stagiaire['user']['id']}',
  ))
      .data!;

  const userFields = [
    'id', 'nom', 'prenom', 'email', 'telephone', 'actif', 'created_at',
  ];
  failures += check(
    userFields.every((f) => profile.containsKey(f)),
    'profile exposes user fields ($userFields)',
  );
  stdout.writeln(
      '  user: ${profile['prenom']} ${profile['nom']} '
      '<${profile['email']}> tel=${profile['telephone']}');

  const stagiaireFields = [
    'ecole', 'specialite', 'niveau', 'competences', 'disponibilite',
  ];
  failures += check(
    stagiaireFields.every((f) => profile.containsKey(f)),
    'profile exposes stagiaire fields ($stagiaireFields)',
  );
  stdout.writeln('  école: ${profile['ecole']} / ${profile['specialite']} '
      '/ ${profile['niveau']}');
  stdout.writeln('  compétences: ${profile['competences']}');

  stdout.writeln('== stages[] list ==');
  failures += check(profile.containsKey('stages'), 'profile exposes stages[]');
  final stages = (profile['stages'] as List).cast<Map<String, dynamic>>();
  const stageFields = [
    'id', 'candidature_id', 'stagiaire_id', 'encadrant_id',
    'departement_id', 'offre_id', 'date_debut', 'date_fin', 'statut',
    'departement_nom', 'encadrant_nom', 'encadrant_prenom',
  ];
  failures += check(
    stages.every((s) => stageFields.every((f) => s.containsKey(f))),
    'stages rows expose ($stageFields)',
  );
  stdout.writeln('  ${stages.length} stage(s)');
  for (final s in stages.take(3)) {
    stdout.writeln('    - ${s['statut']} ${s['date_debut']}→${s['date_fin']} '
        'dpt=${s['departement_nom']} enc=${s['encadrant_prenom']} '
        '${s['encadrant_nom']}');
  }

  stdout.writeln('== Department / supervisor derivation ==');
  final active = stages.firstWhere(
    (s) => s['statut'] == 'EN_COURS',
    orElse: () => stages.isEmpty ? const {} : stages.first,
  );
  if (active.isNotEmpty) {
    failures += check(
      (active['departement_nom'] as String? ?? '').isNotEmpty,
      'active stage carries departement_nom',
    );
    failures += check(
      ((active['encadrant_nom'] as String? ?? '').isNotEmpty &&
          (active['encadrant_prenom'] as String? ?? '').isNotEmpty),
      'active stage carries encadrant names',
    );
    stdout.writeln('  department: ${active['departement_nom']}');
    stdout.writeln('  encadrant: ${active['encadrant_prenom']} '
        '${active['encadrant_nom']}');
  } else {
    stdout.writeln('  (no stage rows to derive department/encadrant)');
  }

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
