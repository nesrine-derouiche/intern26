import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/stagiaire_overview.dart';

void main() {
  group('StagiaireOverview.fromJson', () {
    test('parses the real /stagiaires/overview payload', () {
      final overview = StagiaireOverview.fromJson({
        'trainee': {'id': 'u1', 'nom': 'Trabelsi', 'prenom': 'Fatma', 'email': 'fatma@steg.tn'},
        'internship': {
          'id': 'st1',
          'title': 'Développeur Angular',
          'start_date': '2026-04-30T23:00:00.000Z',
          'end_date': '2026-12-30T23:00:00.000Z',
          'status': 'EN_COURS',
          'supervisor': {'id': 'e1', 'full_name': 'Ahmed Ben Salah'},
        },
        'project': {'id': 'pr1', 'titre': 'Dashboard', 'avancement': 40},
        'tasks': {'total': 4, 'todo': 1, 'in_progress': 1, 'completed': 2, 'overdue': 0},
        'upcoming_meetings': [
          {'id': 'm1', 'sujet': 'Revue', 'date': '2026-09-30T22:00:00.000Z', 'heure': '14:00:00'},
        ],
        'journal': {'total': 20, 'submitted': 20, 'pending': 0},
        'evaluation': {'id': 'ev1', 'note_finale': '16.00', 'validee': true},
      });

      expect(overview.hasStage, isTrue);
      expect(overview.tasks.total, 4);
      expect(overview.journal?.submitted, 20);
      expect(overview.upcomingMeetings, hasLength(1));
      expect(overview.evaluation?.noteFinale, 16.0);
      expect(overview.evaluation?.validee, isTrue);
    });

    test('parses a numeric note_finale sent as a number', () {
      final overview = StagiaireOverview.fromJson({
        'tasks': <String, dynamic>{},
        'upcoming_meetings': <dynamic>[],
        'evaluation': {'id': 'ev2', 'note_finale': 14.5, 'validee': false},
      });

      expect(overview.evaluation?.noteFinale, 14.5);
      expect(overview.evaluation?.validee, isFalse);
    });

    test('tolerates a missing, empty or non numeric note_finale', () {
      final empty = StagiaireOverview.fromJson({
        'tasks': <String, dynamic>{},
        'upcoming_meetings': <dynamic>[],
        'evaluation': {'id': 'ev3', 'note_finale': '', 'validee': false},
      });
      final absent = StagiaireOverview.fromJson({
        'tasks': <String, dynamic>{},
        'upcoming_meetings': <dynamic>[],
        'evaluation': {'id': 'ev4', 'validee': false},
      });

      expect(empty.evaluation?.noteFinale, isNull);
      expect(absent.evaluation?.noteFinale, isNull);
    });

    test('defaults counts when the API omits them', () {
      final overview = StagiaireOverview.fromJson({
        'tasks': <String, dynamic>{},
        'upcoming_meetings': <dynamic>[],
      });

      expect(overview.tasks.total, 0);
      expect(overview.hasStage, isFalse);
      expect(overview.upcomingMeetings, isEmpty);
    });
  });
}
