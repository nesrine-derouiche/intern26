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
  final stagDio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      contentType: 'application/json',
      headers: {'Authorization': 'Bearer ${stagiaire['token']}'},
    ),
  );

  stdout.writeln('== GET /dashboard/stats (stage dates for calendar) ==');
  final stats = (await stagDio.get<Map<String, dynamic>>('/dashboard/stats')).data!;
  final recentStages = (stats['recentStages'] as List).cast<Map<String, dynamic>>();
  final active = recentStages.firstOrNull;
  failures += check(active != null, 'recentStages has an active stage');
  String? stageId;
  if (active != null) {
    stageId = active['id'] as String?;
    final dateDebut = DateTime.tryParse('${active['date_debut']}');
    final dateFin = DateTime.tryParse('${active['date_fin']}');
    failures += check(dateDebut != null, 'stage date_debut parses to a date');
    failures += check(dateFin != null, 'stage date_fin parses to a date');
    failures += check(
      dateDebut != null && dateFin != null && !dateFin.isBefore(dateDebut),
      'date_fin is not before date_debut',
    );
    stdout.writeln('  stage ${active['offre_titre']}: '
        '${active['date_debut']} -> ${active['date_fin']} '
        '(${active['statut']})');
  }

  stdout.writeln('== GET /evaluations ==');
  final evaluations = (await stagDio.get<Map<String, dynamic>>('/evaluations',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final evaluationRows =
      (evaluations['data'] as List).cast<Map<String, dynamic>>();
  final evaluationFields = [
    'id', 'stage_id', 'encadrant_id', 'technique', 'communication',
    'autonomie', 'ponctualite', 'qualite', 'note_finale', 'commentaire',
    'date_evaluation', 'validee',
  ];
  failures += check(
    evaluationRows.every((e) => evaluationFields.every((f) => e.containsKey(f))),
    'GET /evaluations rows expose all fields',
  );
  failures += check(
    evaluationRows.every((e) => double.tryParse('${e['note_finale']}') != null),
    'note_finale parses to a number (string-safe)',
  );
  failures += check(
    evaluationRows.every((e) => DateTime.tryParse('${e['date_evaluation']}') != null),
    'date_evaluation parses to a date',
  );
  stdout.writeln('  ${evaluationRows.length} évaluation(s)');
  for (final e in evaluationRows.take(3)) {
    stdout.writeln('    - note ${e['note_finale']}/20 le ${e['date_evaluation']} '
        '(validee=${e['validee']})');
  }

  stdout.writeln('== GET /reunions (calendar events) ==');
  final reunions = (await stagDio.get<Map<String, dynamic>>('/reunions',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final reunionRows = (reunions['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    reunionRows.every((r) => DateTime.tryParse('${r['date']}') != null),
    'réunion date parses to a date',
  );
  stdout.writeln('  ${reunionRows.length} réunion(s) visibles');

  if (stageId != null) {
    stdout.writeln('== GET /stages/$stageId/documents (weekly reports) ==');
    final documents = (await stagDio.get<Map<String, dynamic>>(
            '/stages/$stageId/documents',
            queryParameters: {'page': 1, 'limit': 100}))
        .data!;
    final documentRows =
        (documents['data'] as List).cast<Map<String, dynamic>>();
    failures += check(
      documentRows.every(
        (d) =>
            d.containsKey('id') &&
            d.containsKey('type') &&
            d.containsKey('nom') &&
            d.containsKey('date_depot'),
      ),
      'document rows expose id/type/nom/date_depot',
    );
    final rapports = documentRows
        .where((d) => '${d['type']}'.toUpperCase() == 'RAPPORT')
        .toList();
    stdout.writeln('  ${documentRows.length} document(s), '
        '${rapports.length} de type RAPPORT (données seed: rapport table '
        'non exposée, RAPPORT documents arrivent via upload)');
    for (final d in rapports.take(3)) {
      stdout.writeln('    - ${d['nom']} déposé le ${d['date_depot']}');
    }
  } else {
    stdout.writeln('  (skip documents: no active stage)');
  }

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
