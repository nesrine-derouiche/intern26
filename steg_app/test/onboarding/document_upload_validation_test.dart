import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/screens/onboarding/document_upload_validation.dart';

void main() {
  group('validateDocumentFile', () {
    test('accepte les extensions autorisées (alignées sur le backend)', () {
      for (final name in [
        'cv.pdf',
        'cin.jpg',
        'cin.jpeg',
        'photo.png',
        'lettre.doc',
        'lettre.docx',
        'CV.PDF',
      ]) {
        expect(
          validateDocumentFile(fileName: name, sizeBytes: 1000),
          isNull,
          reason: '$name devrait être accepté',
        );
      }
    });

    test('refuse une extension non autorisée', () {
      expect(
        validateDocumentFile(fileName: 'malveillant.exe', sizeBytes: 1000),
        contains('non autorisé'),
      );
      expect(
        validateDocumentFile(fileName: 'archive.zip', sizeBytes: 1000),
        contains('non autorisé'),
      );
    });

    test('refuse un fichier sans extension', () {
      expect(
        validateDocumentFile(fileName: 'sans-extension', sizeBytes: 1000),
        contains('non autorisé'),
      );
    });

    test('refuse un fichier de plus de 10 Mo', () {
      expect(
        validateDocumentFile(
          fileName: 'gros.pdf',
          sizeBytes: documentUploadMaxSizeBytes + 1,
        ),
        contains('trop volumineux'),
      );
    });

    test('accepte un fichier de 10 Mo exactement', () {
      expect(
        validateDocumentFile(
          fileName: 'max.pdf',
          sizeBytes: documentUploadMaxSizeBytes,
        ),
        isNull,
      );
    });
  });
}
