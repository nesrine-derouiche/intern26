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

  stdout.writeln('== GET /dashboard/stats ==');
  final stats = (await stagDio.get<Map<String, dynamic>>('/dashboard/stats')).data!;
  final statKeys = [
    'stagesTotal', 'stagesEnCours', 'stagesTermines',
    'tachesTotal', 'tachesEnCours', 'tachesTerminees',
    'tachesAFaire', 'tachesBloquees', 'tachesEnRetard',
    'candidaturesTotal', 'candidaturesEnAttente', 'candidaturesAcceptees',
    'notificationsNonLues', 'recentStages', 'prochainsStages',
    'prochainesReunions', 'recentDocuments', 'recentNotifications',
    'topEncadrants', 'repartitionStatutsStages', 'departements',
  ];
  failures += check(
    statKeys.every((k) => stats.containsKey(k)),
    'GET /dashboard/stats exposes all expected keys',
  );

  final recentStages = (stats['recentStages'] as List).cast<Map<String, dynamic>>();
  final stageFields = [
    'id', 'date_debut', 'date_fin', 'statut',
    'stagiaire_nom', 'stagiaire_prenom',
    'encadrant_nom', 'encadrant_prenom',
    'departement_nom', 'offre_titre',
  ];
  failures += check(
    recentStages.every((s) => stageFields.every((f) => s.containsKey(f))),
    'recentStages rows expose all fields ($stageFields)',
  );
  final active = recentStages.firstOrNull;
  if (active != null) {
    stdout.writeln('  stage: ${active['offre_titre']} (${active['statut']}, '
        '${active['departement_nom']}, ${active['encadrant_prenom']} '
        '${active['encadrant_nom']})');
  }

  final topEncadrants = (stats['topEncadrants'] as List).cast<Map<String, dynamic>>();
  failures += check(
    topEncadrants.every(
      (e) =>
          e.containsKey('encadrant_id') &&
          e.containsKey('nom') &&
          e.containsKey('prenom') &&
          e.containsKey('nb_stages') &&
          e.containsKey('nb_actifs'),
    ),
    'topEncadrants rows expose encadrant_id/nom/prenom/nb_stages/nb_actifs',
  );

  final departements = (stats['departements'] as List).cast<Map<String, dynamic>>();
  failures += check(
    departements.every(
      (d) =>
          d.containsKey('id') &&
          d.containsKey('nom') &&
          d.containsKey('nb_encadrants') &&
          d.containsKey('nb_stages_actifs'),
    ),
    'departements rows expose id/nom/nb_encadrants/nb_stages_actifs',
  );
  stdout.writeln('  stats: ${stats['tachesTotal']} tâches, '
      '${stats['notificationsNonLues']} notifications non lues');

  stdout.writeln('== GET /taches ==');
  final taches = (await stagDio.get<Map<String, dynamic>>('/taches',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final tacheRows = (taches['data'] as List).cast<Map<String, dynamic>>();
  final tacheFields = [
    'id', 'projet_titre', 'createur_nom', 'createur_prenom', 'titre',
    'description', 'priorite', 'date_debut', 'date_fin', 'statut',
    'progress', 'created_at', 'completion_date', 'estimated_hours',
    'spent_hours', 'projet_titre', 'executant_nom', 'executant_prenom',
  ];
  failures += check(
    tacheRows.every((t) => tacheFields.every((f) => t.containsKey(f))),
    'GET /taches rows expose all fields',
  );
  final tacheStatuts = tacheRows.map((t) => t['statut']).toSet();
  failures += check(
    tacheStatuts.every(
      (s) => const {'A_FAIRE', 'EN_COURS', 'TERMINEE', 'BLOQUEE'}.contains(s),
    ),
    'tache statut uses expected enum (got $tacheStatuts)',
  );
  stdout.writeln('  ${tacheRows.length} tâche(s)');
  for (final t in tacheRows.take(3)) {
    stdout.writeln('    - ${t['titre']} (${t['statut']}, ${t['priorite']}, '
        '${t['progress']}%)');
  }

  stdout.writeln('== GET /reunions ==');
  final reunions = (await stagDio.get<Map<String, dynamic>>('/reunions',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final reunionRows = (reunions['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    reunionRows.every(
      (r) =>
          r.containsKey('id') &&
          r.containsKey('stage_id') &&
          r.containsKey('date') &&
          r.containsKey('heure') &&
          r.containsKey('sujet') &&
          r.containsKey('salle') &&
          r.containsKey('encadrant_nom') &&
          r.containsKey('encadrant_prenom'),
    ),
    'GET /reunions rows expose all fields',
  );
  stdout.writeln('  ${reunionRows.length} réunion(s) visibles');

  stdout.writeln('== GET /notifications ==');
  final notifications =
      (await stagDio.get<Map<String, dynamic>>('/notifications',
              queryParameters: {'page': 1, 'limit': 100}))
          .data!;
  final notificationRows =
      (notifications['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    notificationRows.every(
      (n) =>
          n.containsKey('id') &&
          n.containsKey('titre') &&
          n.containsKey('message') &&
          n.containsKey('date') &&
          n.containsKey('type') &&
          n.containsKey('lue'),
    ),
    'GET /notifications rows expose id/titre/message/date/type/lue',
  );

  final unread = (await stagDio.get<Map<String, dynamic>>('/notifications/unread')).data!;
  failures += check(unread.containsKey('total'), 'GET /notifications/unread returns total');

  stdout.writeln('== GET /encadrants ==');
  final encadrants = (await stagDio.get<Map<String, dynamic>>('/encadrants',
          queryParameters: {'page': 1, 'limit': 100}))
      .data!;
  final encadrantRows = (encadrants['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    encadrantRows.every(
      (e) =>
          e.containsKey('id') &&
          e.containsKey('nom') &&
          e.containsKey('prenom') &&
          e.containsKey('nb_stagiaires_actifs'),
    ),
    'GET /encadrants rows expose id/nom/prenom/nb_stagiaires_actifs',
  );
  stdout.writeln('  ${encadrantRows.length} encadrant(s)');

  stdout.writeln('== POST /notifications/:id/lire + /lire-tout ==');
  final firstUnread = notificationRows.firstWhere(
    (n) => n['lue'] == false,
    orElse: () => notificationRows.isEmpty ? const {} : notificationRows.first,
  );
  if (firstUnread.isNotEmpty) {
    final mark = await stagDio.put<Map<String, dynamic>>(
        '/notifications/${firstUnread['id']}/lire');
    failures += check(
      mark.statusCode == 200,
      'PUT /notifications/:id/lire succeeds (${mark.data?['message']})',
    );
  } else {
    stdout.writeln('  (skip mark one: no unread notification)');
  }
  final markAll = await stagDio.put<Map<String, dynamic>>('/notifications/lire-tout');
  failures += check(
    markAll.statusCode == 200,
    'PUT /notifications/lire-tout succeeds (${markAll.data?['message']})',
  );
  final unreadAfter =
      (await stagDio.get<Map<String, dynamic>>('/notifications/unread')).data!;
  failures += check(
    (unreadAfter['total'] as num) == 0,
    'unread count is 0 after lire-tout (got ${unreadAfter['total']})',
  );

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
