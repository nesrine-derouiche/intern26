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

  stdout.writeln('== Admin flow ==');
  final admin = await login('admin@steg.tn', 'admin123');
  failures += check(admin['token'] != null, 'admin login returns token');
  final adminDio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      contentType: 'application/json',
      headers: {'Authorization': 'Bearer ${admin['token']}'},
    ),
  );

  final offres = await adminDio.get<Map<String, dynamic>>('/offres',
      queryParameters: {'page': 1, 'limit': 2});
  final offresData = offres.data!;
  failures += check(offresData['data'] is List, 'GET /offres returns data list');
  failures += check(offresData['total'] is num, 'GET /offres returns total');
  failures += check(offresData['page'] == 1, 'GET /offres returns page');
  failures += check(offresData['pages'] is num, 'GET /offres returns pages');
  final first = (offresData['data'] as List).first as Map<String, dynamic>;
  final requiredFields = [
    'id', 'departement_id', 'titre', 'description', 'duree',
    'competences_demandees', 'nombre_places', 'date_limite', 'statut',
    'departement_nom', 'nb_candidatures',
  ];
  failures += check(
    requiredFields.every((f) => first.containsKey(f)),
    'offre row exposes all fields ($requiredFields)',
  );
  stdout.writeln('  sample: ${first['titre']} (${first['statut']}, '
      '${first['departement_nom']}, ${first['date_limite']})');

  stdout.writeln('== Stagiaire flow ==');
  final stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');
  failures += check(stagiaire['token'] != null, 'stagiaire login returns token');
  final stagDio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      contentType: 'application/json',
      headers: {'Authorization': 'Bearer ${stagiaire['token']}'},
    ),
  );

  final myOffres = await stagDio.get<Map<String, dynamic>>('/offres',
      queryParameters: {'page': 1, 'limit': 100});
  final myOffresData = myOffres.data!;
  final visibleStatuts = (myOffresData['data'] as List)
      .map((o) => (o as Map<String, dynamic>)['statut'])
      .toSet();
  failures += check(
    visibleStatuts.every((s) => s == 'OUVERTE'),
    'stagiaire scope only exposes OUVERTE offers (got $visibleStatuts)',
  );
  stdout.writeln('  stagiaire sees ${myOffresData['total']} offre(s)');

  final myCandidatures = await stagDio.get<Map<String, dynamic>>('/candidatures',
      queryParameters: {'page': 1, 'limit': 100});
  final candidaturesData = myCandidatures.data!;
  failures += check(
    candidaturesData['data'] is List,
    'GET /candidatures returns data list',
  );
  final candidatureRows =
      (candidaturesData['data'] as List).cast<Map<String, dynamic>>();
  final candidatureFields = [
    'id', 'stagiaire_id', 'offre_id', 'date_candidature', 'statut',
    'stagiaire_nom', 'stagiaire_prenom', 'offre_titre', 'departement_nom',
  ];
  failures += check(
    candidatureRows.every((c) => candidatureFields.every((f) => c.containsKey(f))),
    'candidature row exposes all fields ($candidatureFields)',
  );
  final candidatureStatuts = candidatureRows
      .map((c) => c['statut'])
      .toSet();
  failures += check(
    candidatureStatuts.every(
      (s) => const {'EN_ATTENTE', 'ACCEPTEE', 'REFUSEE'}.contains(s),
    ),
    'candidature statut uses expected enum (got $candidatureStatuts)',
  );
  stdout.writeln('  stagiaire has ${candidatureRows.length} candidature(s)');

  final appliedOffreIds = (myCandidatures.data!['data'] as List)
      .map((c) => (c as Map<String, dynamic>)['offre_id']?.toString())
      .toSet();
  final openOffre = (myOffresData['data'] as List)
      .cast<Map<String, dynamic>>()
      .where((o) => !appliedOffreIds.contains(o['id']?.toString()))
      .where((o) => ((o['nombre_places'] as num?)?.toInt() ?? 0) > 0)
      .firstOrNull;

  if (openOffre != null) {
    try {
      final apply = await stagDio.post<Map<String, dynamic>>('/candidatures', data: {
        'stagiaire_id': stagiaire['user']['id'],
        'offre_id': openOffre['id'],
      });
      final created = apply.data!;
      failures += check(
        apply.statusCode == 201 && created['candidature'] != null,
        'POST /candidatures creates a candidature (${created['message']})',
      );
    } on DioException catch (e) {
      final message = (e.response?.data as Map<String, dynamic>?)?['message'] ?? e.message;
      failures += check(
        e.response?.statusCode == 409 || e.response?.statusCode == 201,
        'POST /candidatures handled as expected ($message)',
      );
    }
  } else {
    stdout.writeln('  (skip apply: no open offer left to apply to)');
  }

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
