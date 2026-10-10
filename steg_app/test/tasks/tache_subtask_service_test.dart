import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/models/subtask.dart';
import 'package:steg_app/services/tache_service.dart';

class StubAdapter implements HttpClientAdapter {
  StubAdapter({required this.body, this.statusCode = 200});

  final String body;
  final int statusCode;

  RequestOptions? lastRequest;
  Object? lastData;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    lastData = options.data;
    return ResponseBody.fromString(
      body,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

TacheService serviceFor(StubAdapter stub) {
  return TacheService(Dio()..httpClientAdapter = stub);
}

void main() {
  group('TacheService.listSubtasks', () {
    test('calls the nested endpoint and parses list + aggregate', () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'subtasks': [
            {
              'id': 's1',
              'tache_id': 't1',
              'titre': 'Rédiger',
              'statut': 'TODO'
            },
            {
              'id': 's2',
              'tache_id': 't1',
              'titre': 'Relire',
              'statut': 'DONE'
            },
          ],
          'aggregate': {
            'total': 2,
            'todo': 1,
            'in_progress': 0,
            'done': 1,
            'progress': 50,
            'empty': false,
          },
        }),
      );

      final result = await serviceFor(stub).listSubtasks(taskId: 't1');

      expect(stub.lastRequest?.path, '/taches/t1/subtasks');
      expect(result.subtasks, hasLength(2));
      expect(result.subtasks.map((s) => s.statut), ['TODO', 'DONE']);
      expect(result.aggregate.total, 2);
      expect(result.aggregate.done, 1);
      expect(result.aggregate.progress, 50);
    });

    test('returns an empty, never-NaN aggregate without subtasks', () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'subtasks': [],
          'aggregate': {'total': 0, 'progress': null, 'empty': true},
        }),
      );

      final result = await serviceFor(stub).listSubtasks(taskId: 't1');

      expect(result.subtasks, isEmpty);
      expect(result.aggregate.isEmpty, isTrue);
      expect(result.aggregate.progress, isNull);
      expect(result.aggregate.progressLabel, '—');
    });

    test('computes the aggregate when the payload omits it', () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'subtasks': [
            {
              'id': 's1',
              'tache_id': 't1',
              'titre': 'a',
              'statut': 'TODO'
            },
            {
              'id': 's2',
              'tache_id': 't1',
              'titre': 'b',
              'statut': 'IN_PROGRESS'
            },
          ],
        }),
      );

      final result = await serviceFor(stub).listSubtasks(taskId: 't1');

      expect(result.aggregate.total, 2);
      expect(result.aggregate.progress, 25);
    });

    test('ignores a backend aggregate that does not match the rows',
        () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'subtasks': [
            {
              'id': 's1',
              'tache_id': 't1',
              'titre': 'a',
              'statut': 'TODO'
            },
            {
              'id': 's2',
              'tache_id': 't1',
              'titre': 'b',
              'statut': 'DONE'
            },
          ],
          'aggregate': {'total': 99, 'progress': 77, 'empty': false},
        }),
      );

      final result = await serviceFor(stub).listSubtasks(taskId: 't1');

      expect(result.aggregate.total, 2);
      expect(result.aggregate.progress, 50);
    });

    test('maps a 404 to an ApiException', () async {
      final stub = StubAdapter(
        body: jsonEncode(
            {'success': false, 'message': 'Tâche introuvable.'}),
        statusCode: 404,
      );

      expect(
        () => serviceFor(stub).listSubtasks(taskId: 'missing'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('TacheService.updateSubtaskStatus', () {
    test('patches the status endpoint with the exact value', () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'message': 'Statut mis à jour.',
          'subtask': {
            'id': 's1',
            'tache_id': 't1',
            'titre': 'Rédiger',
            'statut': 'DONE'
          },
        }),
      );

      final updated = await serviceFor(stub).updateSubtaskStatus(
        id: 's1',
        status: SubtaskStatus.done,
      );

      expect(stub.lastRequest?.path, '/subtasks/s1/status');
      expect(stub.lastRequest?.method, 'PATCH');
      expect((stub.lastData as Map)['statut'], 'DONE');
      expect(updated.statut, 'DONE');
    });

    test('maps a 403 to an ApiException', () async {
      final stub = StubAdapter(
        body: jsonEncode({'success': false, 'message': 'Accès refusé.'}),
        statusCode: 403,
      );

      expect(
        () => serviceFor(stub).updateSubtaskStatus(
          id: 's1',
          status: SubtaskStatus.done,
        ),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
