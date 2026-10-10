import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/services/certification_service.dart';

class StubAdapter implements HttpClientAdapter {
  StubAdapter({required this.body, this.statusCode = 200});

  final String body;
  final int statusCode;

  RequestOptions? lastRequest;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    requests.add(options);
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

CertificationService serviceFor(StubAdapter stub) {
  return CertificationService(Dio()..httpClientAdapter = stub);
}

class ScriptedAdapter implements HttpClientAdapter {
  ScriptedAdapter(this.bodies);

  final List<String> bodies;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final index = (requests.length - 1).clamp(0, bodies.length - 1);
    return ResponseBody.fromString(
      bodies[index],
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class ByteAdapter implements HttpClientAdapter {
  ByteAdapter(this.bytes);

  final List<int> bytes;
  RequestOptions? lastRequest;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastRequest = options;
    return ResponseBody.fromBytes(
      bytes,
      200,
      headers: {
        Headers.contentTypeHeader: ['application/pdf'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Map<String, dynamic> stateJson({
  String statut = 'NOT_SUBMITTED',
  bool withDocs = false,
  bool withAttestation = false,
}) {
  return {
    'statut': statut,
    'certification': {
      'id': 'c1',
      'stage_id': 'stage-1',
      'statut': statut,
      'reason': statut == 'DENIED' ? 'Rapport illisible.' : null,
      'document_concerne': null,
      'has_attestation': withAttestation,
      'attestation_nom': withAttestation
          ? 'attestation-stage-1-1700000000.pdf'
          : null,
    },
    'documents': {
      'JOURNAL': withDocs
          ? {
              'id': 'd1',
              'kind': 'JOURNAL',
              'version': 2,
              'nom': 'journal.pdf',
              'taille': 12345,
            }
          : null,
      'RAPPORT': withDocs
          ? {
              'id': 'd2',
              'kind': 'RAPPORT',
              'version': 1,
              'nom': 'rapport.pdf',
              'taille': 67890,
            }
          : null,
    },
    'versions': [],
    'decisions': [],
  };
}

void main() {
  group('CertificationService.getState', () {
    test('parses the full state envelope', () async {
      final stub = StubAdapter(body: jsonEncode(stateJson(withDocs: true)));
      final state = await serviceFor(stub).getState(stageId: 'stage-1');

      expect(stub.lastRequest?.path, '/stages/stage-1/certification');
      expect(state.statut, 'NOT_SUBMITTED');
      expect(state.journal?.nom, 'journal.pdf');
      expect(state.journal?.version, 2);
      expect(state.rapport?.taille, 67890);
      expect(state.hasBothDocuments, isTrue);
      expect(state.canConfirm, isTrue);
    });

    test('parses an empty state', () async {
      final stub = StubAdapter(body: jsonEncode(stateJson()));
      final state = await serviceFor(stub).getState(stageId: 'stage-1');

      expect(state.journal, isNull);
      expect(state.rapport, isNull);
      expect(state.hasBothDocuments, isFalse);
      expect(state.canConfirm, isFalse);
    });

    test('exposes refusal reasons', () async {
      final stub = StubAdapter(
        body: jsonEncode(stateJson(statut: 'DENIED', withDocs: true)),
      );
      final state = await serviceFor(stub).getState(stageId: 'stage-1');

      expect(state.isDenied, isTrue);
      expect(state.reason, 'Rapport illisible.');
      expect(state.canUpload, isTrue);
    });
  });

  group('CertificationService.uploadDocument', () {
    test('posts multipart data to the kind endpoint', () async {
      final dir = await Directory.systemTemp.createTemp('cert_test_');
      final file = File('${dir.path}/journal.pdf');
      await file.writeAsBytes(List.filled(512, 0x25));

      final stub = StubAdapter(
        body: jsonEncode({
          'message': 'Document déposé.',
          'document': {
            'id': 'd1',
            'kind': 'JOURNAL',
            'version': 1,
            'nom': 'journal.pdf',
            'taille': 512,
          },
        }),
      );

      final doc = await serviceFor(stub).uploadDocument(
        stageId: 'stage-1',
        kind: 'JOURNAL',
        filePath: file.path,
        fileName: 'journal.pdf',
      );

      expect(
        stub.lastRequest?.path,
        '/stages/stage-1/certification/documents/JOURNAL',
      );
      expect(stub.lastRequest?.method, 'POST');
      expect(stub.lastRequest?.data, isA<FormData>());
      expect(doc.nom, 'journal.pdf');
      expect(doc.version, 1);

      await dir.delete(recursive: true);
    });

    test('maps a 422 to an ApiException', () async {
      final dir = await Directory.systemTemp.createTemp('cert_test_');
      final file = File('${dir.path}/x.pdf');
      await file.writeAsBytes([1, 2, 3]);

      final stub = StubAdapter(
        body: jsonEncode({'success': false, 'message': 'Contenu invalide.'}),
        statusCode: 422,
      );

      expect(
        () => serviceFor(stub).uploadDocument(
          stageId: 'stage-1',
          kind: 'JOURNAL',
          filePath: file.path,
          fileName: 'x.pdf',
        ),
        throwsA(isA<ApiException>()),
      );

      await dir.delete(recursive: true);
    });
  });

  group('CertificationService.submit', () {
    test('posts submit then reloads the state', () async {
      final adapter = ScriptedAdapter([
        jsonEncode({'message': 'Dossier soumis.'}),
        jsonEncode(stateJson(statut: 'SUBMITTED', withDocs: true)),
      ]);
      final service = CertificationService(Dio()..httpClientAdapter = adapter);

      final state = await service.submit(stageId: 'stage-1');

      expect(adapter.requests, hasLength(2));
      expect(adapter.requests[0].path, '/stages/stage-1/certification/submit');
      expect(adapter.requests[0].method, 'POST');
      expect(state.statut, 'SUBMITTED');
    });

    test('maps an incomplete dossier to an ApiException', () async {
      final stub = StubAdapter(
        body: jsonEncode({'success': false, 'message': 'Dossier incomplet.'}),
        statusCode: 422,
      );

      expect(
        () => serviceFor(stub).submit(stageId: 'stage-1'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('CertificationService.downloadAttestation', () {
    test('exposes the certified attestation in the state', () async {
      final stub = StubAdapter(
        body: jsonEncode(
          stateJson(
            statut: 'CERTIFICATE_GENERATED',
            withDocs: true,
            withAttestation: true,
          ),
        ),
      );
      final state = await serviceFor(stub).getState(stageId: 'stage-1');

      expect(state.hasAttestation, isTrue);
      expect(state.isCertificateGenerated, isTrue);
      expect(state.attestationNom, 'attestation-stage-1-1700000000.pdf');
    });

    test('reports no attestation before generation', () async {
      final stub = StubAdapter(
        body: jsonEncode(stateJson(statut: 'VALIDATED', withDocs: true)),
      );
      final state = await serviceFor(stub).getState(stageId: 'stage-1');

      expect(state.hasAttestation, isFalse);
      expect(state.attestationNom, isNull);
      expect(state.isCertificateGenerated, isFalse);
    });

    test('requests the attestation endpoint with the stage id', () async {
      final adapter = ByteAdapter([37, 80, 68, 70]);
      final service = CertificationService(Dio()..httpClientAdapter = adapter);

      final bytes = await service.downloadAttestation(stageId: 'stage-1');

      expect(adapter.lastRequest?.path,
          '/stages/stage-1/certification/attestation');
      expect(adapter.lastRequest?.method, 'GET');
      expect(adapter.lastRequest?.responseType, ResponseType.bytes);
      expect(bytes, isNotEmpty);
    });

    test('rejects when the server returns no bytes', () async {
      final adapter = ByteAdapter(const []);
      final service = CertificationService(Dio()..httpClientAdapter = adapter);

      expect(
        () => service.downloadAttestation(stageId: 'stage-1'),
        throwsA(isA<ApiException>()),
      );
    });

    test('maps a 404 to an ApiException', () async {
      final stub = StubAdapter(
        body: jsonEncode({
          'success': false,
          'message': 'Aucune attestation générée.',
        }),
        statusCode: 404,
      );

      expect(
        () => serviceFor(stub).downloadAttestation(stageId: 'stage-1'),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
