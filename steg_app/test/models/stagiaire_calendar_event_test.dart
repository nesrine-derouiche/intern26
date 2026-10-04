import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/stagiaire_calendar_event.dart';

void main() {
  group('StagiaireCalendarEvent', () {
    test('parses full JSON', () {
      final event = StagiaireCalendarEvent.fromJson({
        'id': 'reunion-1',
        'type': 'MEETING',
        'title': 'Point projet',
        'date': '2026-07-31',
        'time': '10:30:00',
        'status': null,
        'resource_id': 'r1',
      });

      expect(event.id, 'reunion-1');
      expect(event.type, StagiaireCalendarEventType.meeting);
      expect(event.title, 'Point projet');
      expect(event.date, DateTime(2026, 7, 31));
      expect(event.time, '10:30:00');
      expect(event.status, isNull);
      expect(event.resourceId, 'r1');
    });

    test('defaults for minimal JSON', () {
      final event = StagiaireCalendarEvent.fromJson({
        'id': 't1',
        'type': 'TASK',
        'title': 'Test',
      });

      expect(event.date, isNull);
      expect(event.time, isNull);
      expect(event.status, isNull);
      expect(event.resourceId, isNull);
    });

    test('maps all event types', () {
      expect(
        StagiaireCalendarEventType.fromValue('MEETING'),
        StagiaireCalendarEventType.meeting,
      );
      expect(
        StagiaireCalendarEventType.fromValue('TASK'),
        StagiaireCalendarEventType.task,
      );
      expect(
        StagiaireCalendarEventType.fromValue('INTERNSHIP'),
        StagiaireCalendarEventType.internship,
      );
      expect(StagiaireCalendarEventType.fromValue('UNKNOWN'), isNull);
      expect(StagiaireCalendarEventType.fromValue(null), isNull);
    });

    test('parses stage debut event', () {
      final event = StagiaireCalendarEvent.fromJson({
        'id': 'stage-debut-s1',
        'type': 'INTERNSHIP',
        'title': 'Début du stage',
        'date': '2026-01-15',
        'status': 'EN_COURS',
        'resource_id': 's1',
      });

      expect(event.type, StagiaireCalendarEventType.internship);
      expect(event.title, 'Début du stage');
      expect(event.date, DateTime(2026, 1, 15));
      expect(event.status, 'EN_COURS');
    });

    test('parses task with status', () {
      final event = StagiaireCalendarEvent.fromJson({
        'id': 'tache-t1',
        'type': 'TASK',
        'title': 'Valider le module',
        'date': '2026-08-15',
        'status': 'EN_COURS',
        'resource_id': 't1',
      });

      expect(event.type, StagiaireCalendarEventType.task);
      expect(event.title, 'Valider le module');
      expect(event.status, 'EN_COURS');
      expect(event.resourceId, 't1');
    });
  });
}
