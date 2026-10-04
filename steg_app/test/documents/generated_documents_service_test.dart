import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/services/document_service.dart';

void main() {
  late DocumentService service;

  setUp(() {
    service = DocumentService(Dio());
  });

  group('generatedDocumentsForStage', () {
    test('returns the three official generated documents', () {
      final documents = service.generatedDocumentsForStage(stageId: 'stage-1');

      expect(documents, hasLength(3));
      expect(
        documents.map((document) => document.type),
        ['CONVENTION', 'ATTESTATION', 'EVALUATION'],
      );
    });

    test('uses the expected PDF file names', () {
      final documents = service.generatedDocumentsForStage(stageId: 'stage-1');

      expect(
        documents.map((document) => document.nom),
        ['convention_stage.pdf', 'attestation_stage.pdf', 'evaluation_stage.pdf'],
      );
    });

    test('propagates the stage id', () {
      final documents = service.generatedDocumentsForStage(stageId: 'stage-42');

      expect(documents.every((document) => document.stageId == 'stage-42'), isTrue);
    });

    test('uses the provided generation date', () {
      final date = DateTime(2026, 9, 1);
      final documents = service.generatedDocumentsForStage(
        stageId: 'stage-1',
        generatedAt: date,
      );

      expect(documents.every((document) => document.dateDepot == date), isTrue);
    });

    test('defaults to the current date when none is provided', () {
      final before = DateTime.now();
      final documents = service.generatedDocumentsForStage(stageId: 'stage-1');
      final after = DateTime.now();

      for (final document in documents) {
        expect(document.dateDepot, isNotNull);
        expect(
          document.dateDepot!.isAfter(before.subtract(const Duration(seconds: 1))),
          isTrue,
        );
        expect(
          document.dateDepot!.isBefore(after.add(const Duration(seconds: 1))),
          isTrue,
        );
      }
    });

    test('template version is null when the API does not provide it', () {
      final documents = service.generatedDocumentsForStage(stageId: 'stage-1');

      expect(documents.every((document) => document.templateVersion == null), isTrue);
    });

    test('fromJson parses template_version when present', () {
      final document = DocumentItem.fromJson({
        'id': 'g1',
        'stage_id': 'stage-1',
        'type': 'CONVENTION',
        'nom': 'convention_stage.pdf',
        'template_version': 2,
      });

      expect(document.templateVersion, 2);
    });

    test('fromJson defaults template_version to null', () {
      final document = DocumentItem.fromJson({
        'id': 'g1',
        'stage_id': 'stage-1',
        'type': 'CONVENTION',
        'nom': 'convention_stage.pdf',
      });

      expect(document.templateVersion, isNull);
    });
  });
}
