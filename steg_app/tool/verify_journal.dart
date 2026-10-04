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

  Dio authed(String token) => Dio(
        BaseOptions(
          baseUrl: baseUrl,
          contentType: 'application/json',
          headers: {'Authorization': 'Bearer $token'},
        ),
      );

  int check(bool condition, String label) {
    stdout.writeln('${condition ? 'OK ' : 'FAIL'} $label');
    return condition ? 0 : 1;
  }

  var failures = 0;

  stdout.writeln('== Stagiaire login ==');
  final stagiaire = await login('fatma.trabelsi@steg.tn', 'stagiaire123');
  failures += check(stagiaire['token'] != null, 'stagiaire login returns token');
  final stagDio = authed(stagiaire['token'] as String);

  stdout.writeln('== GET /journals (stagiaire) ==');
  final journals = (await stagDio.get<Map<String, dynamic>>('/journals',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final rows = (journals['data'] as List).cast<Map<String, dynamic>>();
  const journalFields = [
    'id', 'stage_id', 'semaine', 'travaux', 'difficultes', 'solutions',
    'competences', 'heures', 'commentaire', 'statut', 'commentaire_encadrant',
  ];
  failures += check(
    rows.every((j) => journalFields.every((f) => j.containsKey(f))),
    'journal rows expose all core fields',
  );
  failures += check(
    rows.every((j) => DateTime.tryParse('${j['semaine']}') != null),
    'semaine parses to a date',
  );
  failures += check(
    rows.every((j) => double.tryParse('${j['heures']}') != null),
    'heures parses to a number',
  );
  const statuts = {'BROUILLON', 'SOUMIS', 'VALIDE', 'REJETE'};
  failures += check(
    rows.every((j) => statuts.contains('${j['statut']}')),
    'statut is one of BROUILLON/SOUMIS/VALIDE/REJETE',
  );
  stdout.writeln('  ${rows.length} journal(x) visible');

  const targetWeek = '2026-02-09';
  final existing =
      rows.where((j) => '${j['semaine']}' == targetWeek).toList();

  if (existing.isNotEmpty) {
    stdout.writeln('  semaine $targetWeek déjà présente '
        '(${existing.first['statut']}) — phase mutation sautée (idempotent).');
  } else {
    stdout.writeln('== POST /journals (create brouillon, semaine 2026-02-11) ==');
    final stats = (await stagDio.get<Map<String, dynamic>>('/dashboard/stats')).data!;
    final recentStages = (stats['recentStages'] as List).cast<Map<String, dynamic>>();
    final active = recentStages.firstOrNull;
    failures += check(active != null, 'recentStages has an active stage');
    final stageId = active?['id'] ?? (rows.isNotEmpty ? rows.first['stage_id'] : null);
    failures += check(stageId != null, 'resolved a stage_id for the journal');

    final created = (await stagDio.post<Map<String, dynamic>>('/journals', data: {
      'stage_id': stageId,
      'semaine': '2026-02-11',
      'travaux': 'Développement de la fonctionnalité X',
      'difficultes': 'Configuration de l\'environnement',
      'solutions': 'Lecture de la documentation officielle',
      'competences': 'Angular, REST',
      'heures': 40.5,
      'commentaire': 'Bonne semaine de travail',
    })).data!;
    final journal = created['journal'] as Map<String, dynamic>;
    failures += check(journal['id'] != null, 'create returns a journal id');
    failures += check(
      '${journal['semaine']}' == targetWeek,
      'semaine normalisée au lundi ($targetWeek)',
    );
    failures += check(
      '${journal['statut']}' == 'BROUILLON',
      'statut initial BROUILLON',
    );
    failures += check(
      '${journal['heures']}' == '40.5',
      'heures conservées (40.5)',
    );

    final id = journal['id'] as String;

    stdout.writeln('== PUT /journals/$id (update brouillon) ==');
    final updated = (await stagDio.put<Map<String, dynamic>>(
      '/journals/$id',
      data: {
        'travaux': 'Développement de la fonctionnalité X (v2)',
        'difficultes': '',
        'solutions': '',
        'competences': 'Angular, REST, Git',
        'heures': 41,
        'commentaire': '',
      },
    )).data!;
    final updatedJournal = updated['journal'] as Map<String, dynamic>;
    failures += check(
      '${updatedJournal['travaux']}' == 'Développement de la fonctionnalité X (v2)',
      'travaux mis à jour',
    );
    failures += check(
      '${updatedJournal['competences']}' == 'Angular, REST, Git',
      'compétences mises à jour',
    );

    stdout.writeln('== POST /journals/$id/soumettre ==');
    final submitted = (await stagDio.post<Map<String, dynamic>>(
      '/journals/$id/soumettre',
    )).data!;
    final submittedJournal = submitted['journal'] as Map<String, dynamic>;
    failures += check(
      '${submittedJournal['statut']}' == 'SOUMIS',
      'statut SOUMIS après soumission',
    );
    failures += check(
      submittedJournal['date_soumission'] != null,
      'date_soumission renseignée',
    );
  }

  stdout.writeln('== GET /journals (encadrant) ==');
  final encadrant = await login('ahmed.bensalah@steg.tn', 'encadrant123');
  failures += check(encadrant['token'] != null, 'encadrant login returns token');
  final encDio = authed(encadrant['token'] as String);
  final encJournals = (await encDio.get<Map<String, dynamic>>('/journals',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final encRows = (encJournals['data'] as List).cast<Map<String, dynamic>>();
  final target = encRows.where((j) => '${j['semaine']}' == targetWeek).toList();
  failures += check(target.isNotEmpty, 'encadrant voit le journal de la semaine $targetWeek');
  if (target.isEmpty) {
    stdout.writeln('  (semaine $targetWeek absente du scope encadrant)');
  } else {
    final journal = target.first;
    failures += check(
      '${journal['stagiaire_nom']}' == 'Trabelsi',
      'journal expose le nom du stagiaire',
    );
    if ('${journal['statut']}' == 'SOUMIS') {
      stdout.writeln('== POST /journals/${journal['id']}/valider ==');
      final validated = (await encDio.post<Map<String, dynamic>>(
        '/journals/${journal['id']}/valider',
        data: {'commentaire_encadrant': 'Très bon travail, continuez.'},
      )).data!;
      final validatedJournal = validated['journal'] as Map<String, dynamic>;
      failures += check(
        '${validatedJournal['statut']}' == 'VALIDE',
        'statut VALIDE après validation',
      );
      failures += check(
        validatedJournal['commentaire_encadrant'] != null,
        'commentaire_encadrant enregistré',
      );
      failures += check(
        validatedJournal['date_validation'] != null,
        'date_validation renseignée',
      );
    } else {
      stdout.writeln('  journal déjà "${journal['statut']}" — validation sautée.');
    }
  }

  stdout.writeln('== GET /journals (retour stagiaire) ==');
  final finalJournals = (await stagDio.get<Map<String, dynamic>>('/journals',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final finalRows = (finalJournals['data'] as List).cast<Map<String, dynamic>>();
  final finalTarget =
      finalRows.where((j) => '${j['semaine']}' == targetWeek).toList();
  if (finalTarget.isNotEmpty) {
    final journal = finalTarget.first;
    failures += check(
      journal['commentaire_encadrant'] != null,
      'stagiaire voit le commentaire de l\'encadrant',
    );
    stdout.writeln('  semaine $targetWeek → ${journal['statut']} '
        '(commentaire: ${journal['commentaire_encadrant']})');
  } else {
    failures += check(false, 'journal final visible par le stagiaire');
  }

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
