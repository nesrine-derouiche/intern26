import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:steg_app/models/evaluation.dart';

void main() {
  group('Evaluation', () {
    test('fromJson parses a realistic backend row', () {
      final evaluation = Evaluation.fromJson({
        'id': 'ev-1',
        'stage_id': 'stage-1',
        'encadrant_id': 'enc-1',
        'technique': 16,
        'communication': 17,
        'autonomie': 15,
        'ponctualite': 18,
        'qualite': 16,
        'note_finale': '16.40',
        'commentaire': 'Bon travail',
        'date_evaluation': '2026-07-19T13:52:43.495Z',
        'validee': true,
        'stagiaire_nom': 'Trabelsi',
        'stagiaire_prenom': 'Fatma',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
      });

      expect(evaluation.noteFinale, 16.4);
      expect(evaluation.noteLabel, '16.4');
      expect(evaluation.encadrantFullName, 'Ahmed Ben Salah');
      expect(evaluation.validee, isTrue);
      expect(evaluation.dateEvaluation, isNotNull);
    });

    test('noteLabel strips trailing zeros', () {
      expect(Evaluation.fromJson({'note_finale': '16.00'}).noteLabel, '16');
      expect(Evaluation.fromJson({'note_finale': '0'}).noteLabel, '0');
      expect(Evaluation.fromJson({'note_finale': 12.5}).noteLabel, '12.5');
    });

    test('missing fields default safely', () {
      final evaluation = Evaluation.fromJson({});
      expect(evaluation.id, '');
      expect(evaluation.noteFinale, 0);
      expect(evaluation.dateEvaluation, isNull);
      expect(evaluation.encadrantFullName, '');
    });
  });
}
