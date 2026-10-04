import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/models/planning.dart';
import 'package:steg_app/services/planning_service.dart';

class StubAdapter implements HttpClientAdapter {
  StubAdapter({
    required this.body,
    this.statusCode = 200,
    this.failWithConnectionError = false,
    this.failWithUnknownError = false,
  });

  final String body;
  final int statusCode;
  final bool failWithConnectionError;
  final bool failWithUnknownError;

  RequestOptions? lastRequest;
  Map<String, dynamic>? lastQueryParameters;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    lastQueryParameters = options.queryParameters;

    if (failWithConnectionError) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'no route to host',
      );
    }
    if (failWithUnknownError) {
      throw Exception('socket closed');
    }

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

String envelopeJson({
  String? stageId = 'stage-1',
  List<Map<String, dynamic>> events = const [],
  int page = 1,
  int limit = 100,
  int total = 0,
  int pages = 1,
}) {
  return jsonEncode(<String, dynamic>{
    'planning': <String, dynamic>{
      'stage_id': stageId,
      'periode': <String, dynamic>{
        'date_debut': '2026-05-01',
        'date_fin': '2026-12-31',
      },
      'stages': <dynamic>[],
      'horaire': <String, dynamic>{
        'id': 'h1',
        'stage_id': stageId,
        'heure_debut': '09:00',
        'heure_fin': '17:00',
        'duree_pause_minutes': 60,
      },
      'evenements': events,
      'reunions': <dynamic>[],
      'taches': <dynamic>[],
      'pointages': <dynamic>[],
      'pagination': <String, dynamic>{
        'page': page,
        'limit': limit,
        'total': total,
        'pages': pages,
      },
    },
  });
}

Map<String, dynamic> eventJson({
  String id = 'reunion-1',
  String type = 'REUNION',
  String title = 'Point projet',
  String? date = '2026-07-22',
  String? time = '10:00',
  String? status,
  String? resourceId = 'r-1',
}) {
  return <String, dynamic>{
    'id': id,
    'type': type,
    'title': title,
    'date': date,
    'time': time,
    'status': status,
    'resource_id': resourceId,
    'metadata': <String, dynamic>{'stage_id': 'stage-1'},
  };
}

({PlanningService service, StubAdapter adapter}) buildService({
  required String body,
  int statusCode = 200,
  bool failWithConnectionError = false,
  bool failWithUnknownError = false,
}) {
  final adapter = StubAdapter(
    body: body,
    statusCode: statusCode,
    failWithConnectionError: failWithConnectionError,
    failWithUnknownError: failWithUnknownError,
  );
  final dio = Dio(
    BaseOptions(
      baseUrl: 'http://localhost:3000/api',
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
    ),
  );
  dio.httpClientAdapter = adapter;
  return (service: PlanningService(dio), adapter: adapter);
}

void main() {
  group('PlanningService.getPlanning — query parameters', () {
    test('sends every parameter when they are all provided', () async {
      final built = buildService(body: envelopeJson());

      await built.service.getPlanning(
        stageId: 'c144d580',
        dateDebut: '2026-05-01',
        dateFin: '2026-12-31',
        page: 2,
        limit: 50,
      );

      final request = built.adapter.lastRequest!;
      expect(request.method, 'GET');
      expect(request.uri.path, '/api/planning');
      expect(request.uri.queryParameters, <String, String>{
        'stage_id': 'c144d580',
        'date_debut': '2026-05-01',
        'date_fin': '2026-12-31',
        'page': '2',
        'limit': '50',
      });
      expect(built.adapter.lastQueryParameters!['page'], 2);
      expect(built.adapter.lastQueryParameters!['limit'], 50);
    });

    test('sends only page and limit without filters', () async {
      final built = buildService(body: envelopeJson());

      await built.service.getPlanning();

      final request = built.adapter.lastRequest!;
      expect(request.uri.queryParameters, <String, String>{
        'page': '1',
        'limit': '100',
      });
      expect(built.adapter.lastQueryParameters!.containsKey('stage_id'), isFalse);
      expect(
        built.adapter.lastQueryParameters!.containsKey('date_debut'),
        isFalse,
      );
      expect(built.adapter.lastQueryParameters!.containsKey('date_fin'), isFalse);
    });

    test('skips empty optional values', () async {
      final built = buildService(body: envelopeJson());

      await built.service.getPlanning(
        stageId: '',
        dateDebut: null,
        dateFin: '',
      );

      expect(
        built.adapter.lastRequest!.uri.queryParameters,
        <String, String>{'page': '1', 'limit': '100'},
      );
    });

    test('uses the date only format for the period', () async {
      final built = buildService(body: envelopeJson());

      await built.service.getPlanning(
        dateDebut: '2026-06-01',
        dateFin: '2026-06-30',
      );

      final query = built.adapter.lastRequest!.uri.queryParameters;
      expect(query['date_debut'], '2026-06-01');
      expect(query['date_fin'], '2026-06-30');
      expect(query['date_debut'], isNot(contains('T')));
    });
  });

  group('PlanningService.getPlanning — response', () {
    test('parses the object envelope', () async {
      final built = buildService(
        body: envelopeJson(
          events: [eventJson(), eventJson(id: 'tache-1', type: 'TASK_DEADLINE')],
        ),
      );

      final planning = await built.service.getPlanning();

      expect(planning.stageId, 'stage-1');
      expect(planning.periode?.dateDebut, '2026-05-01');
      expect(planning.periode?.dateFin, '2026-12-31');
      expect(planning.horaire?.heureDebut, '09:00');
      expect(planning.evenements, hasLength(2));
      expect(planning.evenements.first.type, PlanningEventType.reunion);
      expect(planning.evenements.last.type, PlanningEventType.taskDeadline);
      expect(planning.evenements.first.metadata['stage_id'], 'stage-1');
    });

    test('parses pagination from the envelope', () async {
      final built = buildService(
        body: envelopeJson(page: 3, limit: 40, total: 120, pages: 3),
      );

      final planning = await built.service.getPlanning(page: 3, limit: 40);

      expect(planning.pagination.page, 3);
      expect(planning.pagination.limit, 40);
      expect(planning.pagination.total, 120);
      expect(planning.pagination.pages, 3);
      expect(planning.pagination.hasNextPage, isFalse);
    });

    test('supports a null stage_id', () async {
      final built = buildService(body: envelopeJson(stageId: null));

      final planning = await built.service.getPlanning();

      expect(planning.stageId, isNull);
      expect(planning.evenements, isEmpty);
    });

    test('throws an explicit FormatException on an invalid envelope', () async {
      final built = buildService(
        body: jsonEncode(<String, dynamic>{'data': <String, dynamic>{}}),
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws an explicit FormatException on an unknown event type', () async {
      final built = buildService(
        body: envelopeJson(events: [eventJson(type: 'POINTAGE')]),
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<FormatException>().having(
            (error) => error.message,
            'message',
            contains('POINTAGE'),
          ),
        ),
      );
    });
  });

  group('PlanningService.getPlanning — errors', () {
    test('maps 401 to an unauthorized ApiException', () async {
      final built = buildService(
        body: jsonEncode(<String, dynamic>{'message': 'Token invalide'}),
        statusCode: 401,
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 401)
              .having((error) => error.isUnauthorized, 'isUnauthorized', isTrue)
              .having((error) => error.isNetworkError, 'isNetworkError', isFalse)
              .having((error) => error.message, 'message', 'Token invalide'),
        ),
      );
    });

    test('maps 403 to a forbidden ApiException', () async {
      final built = buildService(
        body: jsonEncode(<String, dynamic>{
          'message':
              'Accès refusé. Rôles autorisés : STAGIAIRE, ENCADRANT, CHEF_DEPARTEMENT, RH, ADMIN',
        }),
        statusCode: 403,
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 403)
              .having((error) => error.isUnauthorized, 'isUnauthorized', isFalse)
              .having((error) => error.isNetworkError, 'isNetworkError', isFalse)
              .having(
                (error) => error.message,
                'message',
                contains('Rôles autorisés'),
              ),
        ),
      );
    });

    test('maps a server error to its message', () async {
      final built = buildService(
        body: jsonEncode(<String, dynamic>{'message': 'Erreur interne'}),
        statusCode: 500,
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 500)
              .having((error) => error.message, 'message', 'Erreur interne'),
        ),
      );
    });

    test('maps a connection error to a network ApiException', () async {
      final built = buildService(
        body: '',
        failWithConnectionError: true,
      );

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', isNull)
              .having((error) => error.isNetworkError, 'isNetworkError', isTrue)
              .having((error) => error.isUnauthorized, 'isUnauthorized', isFalse)
              .having(
                (error) => error.message,
                'message',
                'Impossible de joindre le serveur. Vérifiez votre connexion.',
              ),
        ),
      );
    });

    test('maps an unexpected transport failure to a generic ApiException', () async {
      final built = buildService(body: '', failWithUnknownError: true);

      await expectLater(
        built.service.getPlanning(),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', isNull)
              .having((error) => error.isNetworkError, 'isNetworkError', isTrue)
              .having((error) => error.message, 'message', isNotEmpty),
        ),
      );
    });
  });
}
