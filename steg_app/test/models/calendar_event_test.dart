import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:steg_app/models/calendar_event.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart';
import 'package:steg_app/models/internship.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/tache.dart';

void main() {
  final internship = Internship.fromJson({
    'id': 's-1',
    'date_debut': '2026-06-01',
    'date_fin': '2026-09-30',
    'statut': 'EN_COURS',
    'offre_titre': 'Développeur Angular',
  });

  group('fromInternship', () {
    test('creates start and end events with their colors', () {
      final start = CalendarEvent.fromInternshipStart(internship);
      final end = CalendarEvent.fromInternshipEnd(internship);

      expect(start.type, CalendarEventType.stageDebut);
      expect(start.day, DateTime(2026, 6, 1));
      expect(start.allDay, isTrue);
      expect(start.title, 'Début du stage');
      expect(start.description, 'Développeur Angular');
      expect(start.type.color, CalendarEventType.stageDebut.color);

      expect(end.type, CalendarEventType.stageFin);
      expect(end.day, DateTime(2026, 9, 30));
    });
  });

  group('fromReunion', () {
    test('uses the subject, time and room', () {
      final reunion = Reunion.fromJson({
        'id': 'r-1',
        'sujet': 'Point projet',
        'date': '2026-07-31',
        'heure': '10:30:00',
        'salle': 'B204',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
      });

      final event = CalendarEvent.fromReunion(reunion);
      expect(event.type, CalendarEventType.reunion);
      expect(event.title, 'Point projet');
      expect(event.time, '10h30');
      expect(event.location, 'B204');
      expect(event.day, DateTime(2026, 7, 31));
    });
  });

  group('fromTache', () {
    test('uses the deadline as the event date', () {
      final tache = Tache.fromJson({
        'id': 't-1',
        'titre': 'Valider le module',
        'statut': 'EN_COURS',
        'date_fin': '2026-08-15',
      });

      final event = CalendarEvent.fromTache(tache);
      expect(event.type, CalendarEventType.tacheEcheance);
      expect(event.title, 'Échéance : Valider le module');
      expect(event.day, DateTime(2026, 8, 15));
    });

    test('drops tasks without a deadline', () {
      final tache = Tache.fromJson({'id': 't-2', 'titre': 'Sans date'});
      expect(CalendarEvent.fromTache(tache).day, isNull);
    });
  });

  group('fromEvaluation', () {
    test('mentions the final grade', () {
      final evaluation = Evaluation.fromJson({
        'id': 'ev-1',
        'note_finale': '16.40',
        'date_evaluation': '2026-07-19T13:52:43.495Z',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
      });

      final event = CalendarEvent.fromEvaluation(evaluation);
      expect(event.type, CalendarEventType.evaluation);
      expect(event.description, 'Note finale : 16.4/20');
      expect(event.location, 'Ahmed Ben Salah');
    });
  });

  group('fromRapport', () {
    test('creates an event on the deposit date', () {
      final document = DocumentItem.fromJson({
        'id': 'd-1',
        'type': 'RAPPORT',
        'nom': 'rapport-hebdo.pdf',
        'date_depot': '2026-08-07T08:00:00.000Z',
      });

      final event = CalendarEvent.fromRapport(document);
      expect(event.type, CalendarEventType.rapportHebdo);
      expect(event.title, 'rapport-hebdo.pdf');
      expect(event.day, DateTime(2026, 8, 7));
    });
  });
}
