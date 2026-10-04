import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/mappers/planning_event_mapper.dart';
import 'package:steg_app/models/calendar_event.dart';
import 'package:steg_app/models/planning.dart';

PlanningEvent buildEvent({
  String id = 'reunion-1',
  PlanningEventType type = PlanningEventType.reunion,
  String title = 'Point projet',
  String? date = '2026-07-22',
  String? time = '10:00',
  String? status,
  String? resourceId = 'r-1',
  Map<String, dynamic> metadata = const {},
}) {
  return PlanningEvent(
    id: id,
    type: type,
    title: title,
    date: date,
    time: time,
    status: status,
    resourceId: resourceId,
    metadata: metadata,
  );
}

void main() {
  group('PlanningEventMapper.mapType', () {
    test('maps the six planning types to calendar types', () {
      expect(
        PlanningEventMapper.mapType(PlanningEventType.stageStart),
        CalendarEventType.stageDebut,
      );
      expect(
        PlanningEventMapper.mapType(PlanningEventType.stageEnd),
        CalendarEventType.stageFin,
      );
      expect(
        PlanningEventMapper.mapType(PlanningEventType.reunion),
        CalendarEventType.reunion,
      );
      expect(
        PlanningEventMapper.mapType(PlanningEventType.taskDeadline),
        CalendarEventType.tacheEcheance,
      );
      expect(
        PlanningEventMapper.mapType(PlanningEventType.pointageEntree),
        CalendarEventType.pointageEntree,
      );
      expect(
        PlanningEventMapper.mapType(PlanningEventType.pointageSortie),
        CalendarEventType.pointageSortie,
      );
    });

    test('covers every planning type without a fallback', () {
      final mapped = PlanningEventType.values
          .map(PlanningEventMapper.mapType)
          .toSet();

      expect(mapped, hasLength(PlanningEventType.values.length));
    });

    test('keeps the six pre existing calendar types reachable', () {
      expect(
        CalendarEventType.values,
        containsAll([
          CalendarEventType.stageDebut,
          CalendarEventType.stageFin,
          CalendarEventType.reunion,
          CalendarEventType.tacheEcheance,
          CalendarEventType.evaluation,
          CalendarEventType.rapportHebdo,
        ]),
      );
    });
  });

  group('pointage types', () {
    test('adds the two pointage values to CalendarEventType', () {
      expect(CalendarEventType.values, hasLength(8));
      expect(
        CalendarEventType.values.map((type) => type.value).toSet(),
        containsAll([
          'STAGE_DEBUT',
          'STAGE_FIN',
          'REUNION',
          'TACHE_ECHEANCE',
          'POINTAGE_ENTREE',
          'POINTAGE_SORTIE',
        ]),
      );
      expect(CalendarEventType.pointageEntree.value, 'POINTAGE_ENTREE');
      expect(CalendarEventType.pointageSortie.value, 'POINTAGE_SORTIE');
    });

    test('exposes coherent labels and icons', () {
      expect(CalendarEventType.pointageEntree.label, 'Pointage — entrée');
      expect(CalendarEventType.pointageSortie.label, 'Pointage — sortie');
      expect(CalendarEventType.pointageEntree.icon, Icons.login_outlined);
      expect(CalendarEventType.pointageSortie.icon, Icons.logout_outlined);
    });

    test('maps entrance and exit pointages to distinct types', () {
      final entree = PlanningEventMapper.toCalendarEvent(
        buildEvent(
          id: 'pointage-entree-p1',
          type: PlanningEventType.pointageEntree,
          title: 'Pointage — entrée',
          date: '2026-09-30',
          time: '08:14',
          status: 'PRESENT',
          resourceId: 'p1',
        ),
      );
      final sortie = PlanningEventMapper.toCalendarEvent(
        buildEvent(
          id: 'pointage-sortie-p1',
          type: PlanningEventType.pointageSortie,
          title: 'Pointage — sortie',
          date: '2026-09-30',
          time: '17:02',
          status: 'PRESENT',
          resourceId: 'p1',
        ),
      );

      expect(entree.type, CalendarEventType.pointageEntree);
      expect(sortie.type, CalendarEventType.pointageSortie);
      expect(entree.type, isNot(sortie.type));
      expect(entree.type.label, 'Pointage — entrée');
      expect(sortie.type.label, 'Pointage — sortie');
      expect(entree.time, '08:14');
      expect(sortie.time, '17:02');
      expect(entree.allDay, isFalse);
      expect(sortie.allDay, isFalse);
      expect(entree.day, DateTime(2026, 9, 30));
      expect(sortie.day, DateTime(2026, 9, 30));
    });
  });

  group('PlanningEventMapper.toCalendarEvent', () {
    test('keeps id and title', () {
      final mapped = PlanningEventMapper.toCalendarEvent(
        buildEvent(
          id: 'stage-start-s1',
          type: PlanningEventType.stageStart,
          title: 'Début du stage',
        ),
      );

      expect(mapped.id, 'stage-start-s1');
      expect(mapped.title, 'Début du stage');
      expect(mapped.type, CalendarEventType.stageDebut);
    });

    test('allDay is true only when time is null', () {
      final timed = PlanningEventMapper.toCalendarEvent(buildEvent(time: '10:00'));
      final untimed = PlanningEventMapper.toCalendarEvent(buildEvent(time: null));
      final task = PlanningEventMapper.toCalendarEvent(
        buildEvent(
          type: PlanningEventType.taskDeadline,
          title: 'Valider le module',
          time: null,
        ),
      );

      expect(timed.allDay, isFalse);
      expect(untimed.allDay, isTrue);
      expect(task.allDay, isTrue);
      expect(timed.time, '10:00');
      expect(untimed.time, isNull);
    });

    test('keeps the exact same day for a date only value', () {
      final mapped = PlanningEventMapper.toCalendarEvent(
        buildEvent(type: PlanningEventType.stageStart, date: '2026-05-01'),
      );

      expect(mapped.date, DateTime(2026, 5, 1));
      expect(mapped.day, DateTime(2026, 5, 1));
      expect(mapped.date!.isUtc, isFalse);
      expect(mapped.day!.year, 2026);
      expect(mapped.day!.month, 5);
      expect(mapped.day!.day, 1);
    });

    test('keeps end of year and end of month days', () {
      final lastDay = PlanningEventMapper.toCalendarEvent(buildEvent(date: '2026-12-31'));
      final february = PlanningEventMapper.toCalendarEvent(buildEvent(date: '2026-02-28'));

      expect(lastDay.day, DateTime(2026, 12, 31));
      expect(february.day, DateTime(2026, 2, 28));
    });

    test('keeps the calendar day when a timestamp is received', () {
      final mapped = PlanningEventMapper.toCalendarEvent(
        buildEvent(date: '2026-04-30T23:00:00.000Z'),
      );

      expect(mapped.date, DateTime(2026, 4, 30));
      expect(mapped.day, DateTime(2026, 4, 30));
      expect(mapped.day!.day, 30);
    });

    test('supports a null date and a null time', () {
      final mapped = PlanningEventMapper.toCalendarEvent(
        buildEvent(date: null, time: null),
      );

      expect(mapped.date, isNull);
      expect(mapped.time, isNull);
      expect(mapped.day, isNull);
      expect(mapped.allDay, isTrue);
    });

    test('keeps status in description', () {
      final source = buildEvent(
        type: PlanningEventType.pointageEntree,
        status: 'RETARD',
      );
      final withStatus = PlanningEventMapper.toCalendarEvent(source);
      final withoutStatus = PlanningEventMapper.toCalendarEvent(
        buildEvent(type: PlanningEventType.reunion, status: null),
      );

      expect(source.status, 'RETARD');
      expect(withStatus.description, 'RETARD');
      expect(withoutStatus.description, isNull);
    });

    test('keeps resource_id in location', () {
      final mapped = PlanningEventMapper.toCalendarEvent(
        buildEvent(resourceId: '118359eb-30ed-4692-9b19-ef672ec037eb'),
      );
      final missing = PlanningEventMapper.toCalendarEvent(
        buildEvent(resourceId: null),
      );

      expect(mapped.location, '118359eb-30ed-4692-9b19-ef672ec037eb');
      expect(missing.location, isNull);
    });

    test('leaves metadata on the planning event', () {
      final source = buildEvent(
        type: PlanningEventType.pointageEntree,
        metadata: <String, dynamic>{
          'stage_id': 's1',
          'retard_minutes': 15,
        },
      );

      final mapped = PlanningEventMapper.toCalendarEvent(source);

      expect(source.metadata['stage_id'], 's1');
      expect(source.metadata['retard_minutes'], 15);
      expect(mapped.type, CalendarEventType.pointageEntree);
      expect(mapped.title, 'Point projet');
    });

    test('maps a realistic payload built from JSON', () {
      final planning = Planning.fromEnvelope(<String, dynamic>{
        'planning': <String, dynamic>{
          'evenements': [
            <String, dynamic>{
              'id': 'reunion-r1',
              'type': 'REUNION',
              'title': "Point d'avancement",
              'date': '2026-07-22',
              'time': '10:00',
              'status': null,
              'resource_id': 'r1',
              'metadata': <String, dynamic>{'salle': 'Salle B204'},
            },
            <String, dynamic>{
              'id': 'pointage-entree-p1',
              'type': 'POINTAGE_ENTREE',
              'title': 'Pointage — entrée',
              'date': '2026-09-30',
              'time': '08:14',
              'status': 'PRESENT',
              'resource_id': 'p1',
              'metadata': <String, dynamic>{'stage_id': 's1'},
            },
          ],
          'pagination': <String, dynamic>{'page': 1, 'limit': 100, 'total': 2, 'pages': 1},
        },
      });

      final events = PlanningEventMapper.toCalendarEvents(planning.evenements);

      expect(events, hasLength(2));
      expect(events.first.type, CalendarEventType.reunion);
      expect(events.first.location, 'r1');
      expect(events.first.description, isNull);
      expect(events.first.allDay, isFalse);
      expect(events.last.type, CalendarEventType.pointageEntree);
      expect(events.last.description, 'PRESENT');
      expect(events.last.day, DateTime(2026, 9, 30));
    });
  });

  group('PlanningEventMapper.toCalendarEvents', () {
    test('maps every event and keeps the order', () {
      final source = [
        buildEvent(
          id: 'stage-start-s1',
          type: PlanningEventType.stageStart,
          title: 'Début du stage',
          date: '2026-05-01',
          time: null,
        ),
        buildEvent(
          id: 'stage-end-s1',
          type: PlanningEventType.stageEnd,
          title: 'Fin du stage',
          date: '2026-12-31',
          time: null,
        ),
        buildEvent(
          id: 'tache-t1',
          type: PlanningEventType.taskDeadline,
          title: 'Échéance',
          date: '2026-07-15',
          time: null,
        ),
        buildEvent(
          id: 'pointage-sortie-p1',
          type: PlanningEventType.pointageSortie,
          date: '2026-09-30',
          time: '17:02',
        ),
      ];

      final events = PlanningEventMapper.toCalendarEvents(source);

      expect(events, hasLength(4));
      expect(events.map((event) => event.id), [
        'stage-start-s1',
        'stage-end-s1',
        'tache-t1',
        'pointage-sortie-p1',
      ]);
      expect(events[0].type, CalendarEventType.stageDebut);
      expect(events[1].type, CalendarEventType.stageFin);
      expect(events[2].type, CalendarEventType.tacheEcheance);
      expect(events[3].type, CalendarEventType.pointageSortie);
      expect(events[0].allDay, isTrue);
      expect(events[3].allDay, isFalse);
    });

    test('returns an empty list for no event', () {
      expect(PlanningEventMapper.toCalendarEvents(const []), isEmpty);
    });
  });
}
