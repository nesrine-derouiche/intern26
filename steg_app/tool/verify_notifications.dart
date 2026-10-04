import 'dart:io';

import 'package:dio/dio.dart';

const baseUrl = 'http://localhost:3000/api';

void main() async {
  final dio = Dio(BaseOptions(baseUrl: baseUrl, contentType: 'application/json'));

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
  final api = authed(stagiaire['token'] as String);

  stdout.writeln('== Unread count ==');
  final unread = (await api.get<Map<String, dynamic>>('/notifications/unread')).data!;
  final unreadTotal = (unread['total'] as num?)?.toInt() ?? 0;
  failures += check(unread.containsKey('total'), 'unread endpoint exposes total');
  stdout.writeln('  total non lues = $unreadTotal');

  stdout.writeln('== Full list (paginated) ==');
  final page = (await api.get<Map<String, dynamic>>(
    '/notifications',
    queryParameters: {'page': 1, 'limit': 100},
  )).data!;
  final rows = (page['data'] as List).cast<Map<String, dynamic>>();
  const fields = ['id', 'utilisateur_id', 'titre', 'message', 'date', 'type', 'lue'];
  failures += check(rows.every((n) => fields.every((f) => n.containsKey(f))),
      'rows expose id/titre/message/date/type/lue');
  failures += check(page['total'] is num, 'total present');
  stdout.writeln('  total notifications = ${page['total']}');

  stdout.writeln('== Type filter ==');
  final filtered = (await api.get<Map<String, dynamic>>(
    '/notifications',
    queryParameters: {'page': 1, 'limit': 100, 'type': 'REUNION,TACHE'},
  )).data!;
  final filteredRows = (filtered['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    filteredRows.every((n) => ['REUNION', 'TACHE'].contains(n['type'])),
    'type=REUNION,TACHE returns only those types',
  );
  failures += check(filteredRows.isNotEmpty, 'type filter returns results');

  stdout.writeln('== Unread count consistency ==');
  final derivedUnread = rows.where((n) => n['lue'] == false).length;
  failures += check(
    unreadTotal == derivedUnread,
    'unread endpoint matches the loaded list (got $unreadTotal vs $derivedUnread)',
  );

  stdout.writeln('== Device token registration ==');
  final token = 'verify-token-${DateTime.now().millisecondsSinceEpoch}';
  final reg = await api.post<Map<String, dynamic>>(
    '/notifications/device-token',
    data: {'token': token, 'platform': 'android'},
  );
  failures += check(reg.statusCode == 200, 'register device token (200)');
  final regMsg = (reg.data as Map<String, dynamic>)['message'];
  failures += check(regMsg.toString().contains('enregistré'), 'register message');

  var invalidStatus = -1;
  try {
    await api.post<Map<String, dynamic>>(
      '/notifications/device-token',
      data: {'token': ''},
    );
  } on DioException catch (error) {
    invalidStatus = error.response?.statusCode ?? -1;
  }
  failures += check(invalidStatus == 400, 'empty token rejected (400)');

  stdout.writeln('== Mark one read ==');
  if (rows.isNotEmpty) {
    final id = rows.first['id'] as String;
    final mark = await api.put<Map<String, dynamic>>('/notifications/$id/lire');
    failures += check(mark.statusCode == 200, 'mark single notification read (200)');

    final after = (await api.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {'page': 1, 'limit': 100},
    )).data!;
    final afterRows = (after['data'] as List).cast<Map<String, dynamic>>();
    final target = afterRows.firstWhere((n) => n['id'] == id);
    failures += check(target['lue'] == true, 'notification now marked as read');
  }

  stdout.writeln('== Delete the marked notification ==');
  if (rows.isNotEmpty) {
    final id = rows.first['id'] as String;
    final del = await api.delete<Map<String, dynamic>>('/notifications/$id');
    failures += check(del.statusCode == 200, 'delete notification (200)');

    final after = (await api.get<Map<String, dynamic>>(
      '/notifications',
      queryParameters: {'page': 1, 'limit': 100},
    )).data!;
    final afterRows = (after['data'] as List).cast<Map<String, dynamic>>();
    failures += check(
      afterRows.every((n) => n['id'] != id),
      'notification removed from history',
    );
  }

  stdout.writeln('== Unregister device token ==');
  final unreg = await api.delete<Map<String, dynamic>>(
    '/notifications/device-token',
    data: {'token': token},
  );
  failures += check(unreg.statusCode == 200, 'unregister device token (200)');

  stdout.writeln(failures == 0
      ? '\nAll checks passed.'
      : '\n$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}
