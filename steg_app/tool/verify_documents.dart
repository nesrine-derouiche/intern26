import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

const baseUrl = 'http://localhost:3000/api';

Future<void> main() async {
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
  final stagDio = authed(stagiaire['token'] as String);

  stdout.writeln('== Resolve active stage ==');
  final stats = (await stagDio.get<Map<String, dynamic>>('/dashboard/stats')).data!;
  final recentStages = (stats['recentStages'] as List).cast<Map<String, dynamic>>();
  final active = recentStages.firstWhereOrNull((s) => '${s['statut']}' == 'EN_COURS');
  final stageId = active?['id'];
  failures += check(stageId != null, 'active EN_COURS stage resolved');
  if (stageId == null) {
    stdout.writeln('  (no active stage — aborting)');
    exit(1);
  }

  stdout.writeln('== GET /stages/$stageId/documents ==');
  final list = (await stagDio.get<Map<String, dynamic>>(
    '/stages/$stageId/documents',
    queryParameters: {'page': 1, 'limit': 100},
  )).data!;
  failures += check(list['data'] is List, 'paginated data list present');
  final rows = (list['data'] as List).cast<Map<String, dynamic>>();
  const fields = ['id', 'stagiaire_id', 'stage_id', 'type', 'nom', 'chemin', 'date_depot'];
  failures += check(
    rows.every((d) => fields.every((f) => d.containsKey(f))),
    'document rows expose all core fields',
  );
  failures += check(
    rows.every((d) => DateTime.tryParse('${d['date_depot']}') != null),
    'date_depot parses to a date',
  );
  final types = {'CV', 'CONVENTION', 'ASSURANCE', 'RAPPORT', 'ATTESTATION'};
  failures += check(
    rows.every((d) => types.contains('${d['type']}')),
    'document type is one of CV/CONVENTION/ASSURANCE/RAPPORT/ATTESTATION',
  );
  stdout.writeln('  ${rows.length} document(s) already deposited');

  stdout.writeln('== Upload RAPPORT / ASSURANCE / CV ==');
  final marker = DateTime.now().millisecondsSinceEpoch;
  final uploadedIds = <String>[];

  Future<void> upload(String type, String fileName) async {
    final bytes = buildMinimalPdf('STEG $type $marker');
    final tmp = File('${Directory.systemTemp.path}/$fileName');
    await tmp.writeAsBytes(bytes, flush: true);
    final form = FormData.fromMap({
      'type': type,
      'file': await MultipartFile.fromFile(tmp.path, filename: fileName),
    });
    final res = (await stagDio.post<Map<String, dynamic>>(
      '/stages/$stageId/documents',
      data: form,
    )).data!;
    final document = res['document'] as Map<String, dynamic>;
    failures += check(
      '${document['type']}' == type && document['id'] != null,
      'upload $type returns a typed document',
    );
    failures += check(
      '${document['nom']}' == fileName,
      'upload keeps the original file name',
    );
    failures += check(
      '${document['stage_id']}' == stageId,
      'upload links the document to the stage',
    );
    uploadedIds.add(document['id'] as String);
    tmp.deleteSync();
  }

  await upload('RAPPORT', 'rapport_verify_$marker.pdf');
  await upload('ASSURANCE', 'assurance_verify_$marker.pdf');
  await upload('CV', 'cv_verify_$marker.pdf');

  final after = (await stagDio.get<Map<String, dynamic>>(
    '/stages/$stageId/documents',
    queryParameters: {'page': 1, 'limit': 100},
  )).data!;
  final afterRows = (after['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    uploadedIds.every((id) => afterRows.any((d) => '${d['id']}' == id)),
    'uploaded documents appear in the stage listing',
  );

  stdout.writeln('== Download / preview an uploaded document ==');
  final targetId = uploadedIds.first;
  final download = await stagDio.get<List<int>>(
    '/documents/$targetId/download',
    options: Options(responseType: ResponseType.bytes),
  );
  failures += check(
    download.statusCode == 200,
    'download returns HTTP 200',
  );
  failures += check(
    _isPdf(download.data),
    'downloaded bytes are a valid PDF',
  );

  final preview = await stagDio.get<List<int>>(
    '/documents/$targetId/preview',
    options: Options(responseType: ResponseType.bytes),
  );
  failures += check(
    preview.statusCode == 200 && _isPdf(preview.data),
    'preview returns inline PDF bytes',
  );

  stdout.writeln('== Generated PDFs (convention / attestation / evaluation) ==');
  for (final kind in ['convention', 'attestation', 'evaluation']) {
    final res = await stagDio.get<List<int>>(
      '/stages/$stageId/pdf/$kind',
      options: Options(responseType: ResponseType.bytes),
    );
    failures += check(
      res.statusCode == 200 && _isPdf(res.data),
      'GET /pdf/$kind returns a valid PDF',
    );
  }

  stdout.writeln('== Encadrant login + cleanup (delete uploaded docs) ==');
  final encadrant = await login('ahmed.bensalah@steg.tn', 'encadrant123');
  failures += check(encadrant['token'] != null, 'encadrant login returns token');
  final encDio = authed(encadrant['token'] as String);

  for (final id in uploadedIds) {
    final res = await encDio.delete<Map<String, dynamic>>('/documents/$id');
    failures += check(res.statusCode == 200, 'DELETE /documents/$id (encadrant)');
  }

  final finalList = (await stagDio.get<Map<String, dynamic>>(
    '/stages/$stageId/documents',
    queryParameters: {'page': 1, 'limit': 100},
  )).data!;
  final finalRows = (finalList['data'] as List).cast<Map<String, dynamic>>();
  failures += check(
    uploadedIds.every((id) => finalRows.every((d) => '${d['id']}' != id)),
    'uploaded documents removed after deletion',
  );

  stdout.writeln();
  stdout.writeln(failures == 0 ? 'All checks passed.' : '$failures check(s) failed.');
  exit(failures == 0 ? 0 : 1);
}

bool _isPdf(List<int>? bytes) {
  if (bytes == null || bytes.length < 5) return false;
  final head = Uint8List.fromList(bytes.sublist(0, 5));
  return const Utf8Decoder().convert(head) == '%PDF-';
}

List<int> buildMinimalPdf(String text) {
  final escText = text.replaceAll('(', r'\(').replaceAll(')', r'\)');
  final streamBody = 'BT /F1 24 Tf 100 700 Td ($escText) Tj ET\n';

  final objects = <String>[
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Length ${streamBody.length} >>\nstream\n$streamBody'
        'endstream\nendobj\n',
  ];

  final buf = StringBuffer('%PDF-1.4\n');
  final offsets = <int>[];
  for (final obj in objects) {
    offsets.add(buf.length);
    buf.write(obj);
  }
  final xrefStart = buf.length;
  buf.write('xref\n0 ${objects.length + 1}\n0000000000 65535 f \n');
  for (final offset in offsets) {
    buf.write('${offset.toString().padLeft(10, '0')} 00000 n \n');
  }
  buf.write('trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n'
      'startxref\n$xrefStart\n%%EOF');
  return utf8.encode(buf.toString());
}

extension FirstWhereOrNull<T> on List<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final item in this) {
      if (test(item)) return item;
    }
    return null;
  }
}
