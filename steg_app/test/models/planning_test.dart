import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/planning.dart';

Map<String, dynamic> sampleEnvelope() => <String, dynamic>{
      'planning': <String, dynamic>{
        'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
        'periode': <String, dynamic>{
          'date_debut': '2026-05-01',
          'date_fin': '2026-12-31',
        },
        'stages': [
          <String, dynamic>{
            'id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'stagiaire_id': '8b6a72f5-630a-46ef-90a5-563a7d0eeee5',
            'encadrant_id': '21dca611-c2a5-4c49-a261-2157639cec1a',
            'date_debut': '2026-05-01',
            'date_fin': '2026-12-31',
            'statut': 'EN_COURS',
            'horaire': <String, dynamic>{
              'id': 'b22efe87-1e96-4dec-ab8d-bf113e84a9f8',
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
              'heure_debut': '09:00',
              'heure_fin': '17:00',
              'duree_pause_minutes': 60,
            },
          },
        ],
        'horaire': <String, dynamic>{
          'id': 'b22efe87-1e96-4dec-ab8d-bf113e84a9f8',
          'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
          'heure_debut': '09:00',
          'heure_fin': '17:00',
          'duree_pause_minutes': 60,
        },
        'evenements': [
          <String, dynamic>{
            'id': 'stage-start-c144d580-e39d-481b-9c01-2758cb2138ae',
            'type': 'STAGE_START',
            'title': 'Début du stage',
            'date': '2026-05-01',
            'time': null,
            'status': 'EN_COURS',
            'resource_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
              'statut': 'EN_COURS',
            },
          },
          <String, dynamic>{
            'id': 'stage-end-c144d580-e39d-481b-9c01-2758cb2138ae',
            'type': 'STAGE_END',
            'title': 'Fin du stage',
            'date': '2026-12-31',
            'time': null,
            'status': 'EN_COURS',
            'resource_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            },
          },
          <String, dynamic>{
            'id': 'reunion-118359eb-30ed-4692-9b19-ef672ec037eb',
            'type': 'REUNION',
            'title': "Point d'avancement projet dashboard",
            'date': '2026-07-22',
            'time': '10:00',
            'status': null,
            'resource_id': '118359eb-30ed-4692-9b19-ef672ec037eb',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
              'salle': 'Salle B204',
              'lien_visio': null,
            },
          },
          <String, dynamic>{
            'id': 'tache-5f3a4a4e-0000-4000-8000-000000000001',
            'type': 'TASK_DEADLINE',
            'title': 'Valider le module',
            'date': '2026-07-15',
            'time': null,
            'status': 'EN_COURS',
            'resource_id': '5f3a4a4e-0000-4000-8000-000000000001',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
              'date_debut': '2026-07-01',
              'progress': 40,
              'priorite': 'HAUTE',
            },
          },
          <String, dynamic>{
            'id': 'pointage-entree-2e893ad7-787c-4403-8572-7c43a5fa358b',
            'type': 'POINTAGE_ENTREE',
            'title': 'Pointage — entrée',
            'date': '2026-09-30',
            'time': '12:14',
            'status': 'RETARD',
            'resource_id': '2e893ad7-787c-4403-8572-7c43a5fa358b',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
              'retard_minutes': 15,
            },
          },
          <String, dynamic>{
            'id': 'pointage-sortie-2e893ad7-787c-4403-8572-7c43a5fa358b',
            'type': 'POINTAGE_SORTIE',
            'title': 'Pointage — sortie',
            'date': '2026-09-30',
            'time': '17:02',
            'status': 'RETARD',
            'resource_id': '2e893ad7-787c-4403-8572-7c43a5fa358b',
            'metadata': <String, dynamic>{
              'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            },
          },
        ],
        'reunions': [
          <String, dynamic>{
            'id': '118359eb-30ed-4692-9b19-ef672ec037eb',
            'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'sujet': "Point d'avancement projet dashboard",
            'date': '2026-07-22',
            'heure': '10:00',
            'salle': 'Salle B204',
            'lien_visio': null,
            'encadrant_nom': 'Bensalah',
            'encadrant_prenom': 'Ahmed',
          },
        ],
        'taches': [
          <String, dynamic>{
            'id': '5f3a4a4e-0000-4000-8000-000000000001',
            'titre': 'Valider le module',
            'description': 'Revue du code',
            'statut': 'EN_COURS',
            'priorite': 'HAUTE',
            'progress': 40,
            'date_debut': '2026-07-01',
            'date_fin': '2026-07-15',
          },
        ],
        'pointages': [
          <String, dynamic>{
            'id': '2e893ad7-787c-4403-8572-7c43a5fa358b',
            'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'date_pointage': '2026-09-30',
            'heure_entree': '12:14',
            'heure_sortie': '17:02',
            'retard_minutes': 15,
            'statut': 'RETARD',
          },
        ],
        'pagination': <String, dynamic>{
          'page': 1,
          'limit': 100,
          'total': 6,
          'pages': 1,
        },
      },
    };

Map<String, dynamic> eventJson(Map<String, dynamic> overrides) => <String, dynamic>{
      'id': 'e1',
      'type': 'REUNION',
      'title': 'Réunion',
      'date': '2026-07-22',
      'time': '10:00',
      'status': null,
      'resource_id': 'r1',
      'metadata': <String, dynamic>{},
      ...overrides,
    };

void main() {
  group('PlanningEventType', () {
    test('exposes exactly the six backend types', () {
      expect(PlanningEventType.values, hasLength(6));
      expect(
        PlanningEventType.values.map((type) => type.value).toSet(),
        {
          'STAGE_START',
          'STAGE_END',
          'REUNION',
          'TASK_DEADLINE',
          'POINTAGE_ENTREE',
          'POINTAGE_SORTIE',
        },
      );
    });

    test('fromValue maps the six values and returns null otherwise', () {
      expect(
        PlanningEventType.fromValue('STAGE_START'),
        PlanningEventType.stageStart,
      );
      expect(
        PlanningEventType.fromValue('STAGE_END'),
        PlanningEventType.stageEnd,
      );
      expect(PlanningEventType.fromValue('REUNION'), PlanningEventType.reunion);
      expect(
        PlanningEventType.fromValue('TASK_DEADLINE'),
        PlanningEventType.taskDeadline,
      );
      expect(
        PlanningEventType.fromValue('POINTAGE_ENTREE'),
        PlanningEventType.pointageEntree,
      );
      expect(
        PlanningEventType.fromValue('POINTAGE_SORTIE'),
        PlanningEventType.pointageSortie,
      );
      expect(PlanningEventType.fromValue('INTERNSHIP'), isNull);
      expect(PlanningEventType.fromValue('MEETING'), isNull);
      expect(PlanningEventType.fromValue(null), isNull);
    });

    test('parse returns the matching type', () {
      expect(PlanningEventType.parse('STAGE_START'), PlanningEventType.stageStart);
      expect(PlanningEventType.parse('STAGE_END'), PlanningEventType.stageEnd);
      expect(PlanningEventType.parse('REUNION'), PlanningEventType.reunion);
      expect(
        PlanningEventType.parse('TASK_DEADLINE'),
        PlanningEventType.taskDeadline,
      );
      expect(
        PlanningEventType.parse('POINTAGE_ENTREE'),
        PlanningEventType.pointageEntree,
      );
      expect(
        PlanningEventType.parse('POINTAGE_SORTIE'),
        PlanningEventType.pointageSortie,
      );
    });

    test('parse throws an explicit FormatException on an unknown type', () {
      expect(
        () => PlanningEventType.parse('POINTAGE'),
        throwsA(
          isA<FormatException>().having(
            (error) => error.message,
            'message',
            contains('POINTAGE'),
          ),
        ),
      );
      expect(
        () => PlanningEventType.parse(null),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('Planning.fromEnvelope', () {
    test('parses the full backend envelope', () {
      final planning = Planning.fromEnvelope(sampleEnvelope());

      expect(planning.stageId, 'c144d580-e39d-481b-9c01-2758cb2138ae');
      expect(planning.periode?.dateDebut, '2026-05-01');
      expect(planning.periode?.dateFin, '2026-12-31');

      expect(planning.stages, hasLength(1));
      expect(planning.stages.first.id, 'c144d580-e39d-481b-9c01-2758cb2138ae');
      expect(planning.stages.first.statut, 'EN_COURS');
      expect(planning.stages.first.horaire?.heureDebut, '09:00');
      expect(planning.horaire?.heureFin, '17:00');
      expect(planning.horaire?.dureePauseMinutes, 60);

      expect(planning.evenements, hasLength(6));
      expect(
        planning.evenements.map((event) => event.type).toSet(),
        {
          PlanningEventType.stageStart,
          PlanningEventType.stageEnd,
          PlanningEventType.reunion,
          PlanningEventType.taskDeadline,
          PlanningEventType.pointageEntree,
          PlanningEventType.pointageSortie,
        },
      );

      expect(planning.reunions, hasLength(1));
      expect(planning.reunions.first.sujet, "Point d'avancement projet dashboard");
      expect(planning.taches, hasLength(1));
      expect(planning.taches.first.titre, 'Valider le module');
      expect(planning.pointages, hasLength(1));
      expect(planning.pointages.first.statut.value, 'RETARD');

      expect(planning.pagination.page, 1);
      expect(planning.pagination.limit, 100);
      expect(planning.pagination.total, 6);
      expect(planning.pagination.pages, 1);
    });

    test('throws when the planning key is missing', () {
      expect(
        () => Planning.fromEnvelope(<String, dynamic>{'data': <String, dynamic>{}}),
        throwsA(isA<FormatException>()),
      );
    });

    test('throws when the planning key is not an object', () {
      expect(
        () => Planning.fromEnvelope(<String, dynamic>{'planning': 'nope'}),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('PlanningEvent', () {
    test('parses the six event types', () {
      final events = <String, PlanningEventType>{
        'STAGE_START': PlanningEventType.stageStart,
        'STAGE_END': PlanningEventType.stageEnd,
        'REUNION': PlanningEventType.reunion,
        'TASK_DEADLINE': PlanningEventType.taskDeadline,
        'POINTAGE_ENTREE': PlanningEventType.pointageEntree,
        'POINTAGE_SORTIE': PlanningEventType.pointageSortie,
      };

      events.forEach((value, expected) {
        final event = PlanningEvent.fromJson(eventJson({'type': value}));
        expect(event.type, expected, reason: value);
        expect(event.id, 'e1');
        expect(event.title, 'Réunion');
      });
    });

    test('keeps date-only values without any timezone shift', () {
      final event =
          PlanningEvent.fromJson(eventJson({'type': 'STAGE_START', 'date': '2026-05-01'}));

      expect(event.date, '2026-05-01');
      expect(event.dateTime, DateTime(2026, 5, 1));
      expect(event.dateTime!.isUtc, isFalse);
      expect(event.dateTime!.year, 2026);
      expect(event.dateTime!.month, 5);
      expect(event.dateTime!.day, 1);
    });

    test('keeps end of year and end of month dates intact', () {
      final lastDay = PlanningEvent.fromJson(eventJson({'date': '2026-12-31'}));
      final february = PlanningEvent.fromJson(eventJson({'date': '2026-02-28'}));

      expect(lastDay.date, '2026-12-31');
      expect(lastDay.dateTime, DateTime(2026, 12, 31));
      expect(february.date, '2026-02-28');
      expect(february.dateTime, DateTime(2026, 2, 28));
    });

    test('keeps the calendar day when a timestamp is received', () {
      final event =
          PlanningEvent.fromJson(eventJson({'date': '2026-04-30T23:00:00.000Z'}));

      expect(event.date, '2026-04-30');
      expect(event.dateTime, DateTime(2026, 4, 30));
    });

    test('keeps time as HH:MM and supports a null time', () {
      final timed = PlanningEvent.fromJson(eventJson({'time': '12:14'}));
      final untimed = PlanningEvent.fromJson(eventJson({'time': null}));
      final missing = PlanningEvent.fromJson({'id': 'e1', 'type': 'REUNION', 'title': 'R'});

      expect(timed.time, '12:14');
      expect(timed.allDay, isFalse);
      expect(untimed.time, isNull);
      expect(untimed.allDay, isTrue);
      expect(missing.time, isNull);
      expect(missing.allDay, isTrue);
    });

    test('keeps metadata with its original values', () {
      final event = PlanningEvent.fromJson(
        eventJson({
          'metadata': <String, dynamic>{
            'stage_id': 'c144d580-e39d-481b-9c01-2758cb2138ae',
            'salle': 'Salle B204',
            'lien_visio': null,
            'retard_minutes': 15,
          },
        }),
      );

      expect(event.metadata['stage_id'], 'c144d580-e39d-481b-9c01-2758cb2138ae');
      expect(event.metadata['salle'], 'Salle B204');
      expect(event.metadata['lien_visio'], isNull);
      expect(event.metadata['retard_minutes'], 15);
    });

    test('defaults metadata to an empty map', () {
      final missing =
          PlanningEvent.fromJson({'id': 'e1', 'type': 'REUNION', 'title': 'R'});
      final explicitNull = PlanningEvent.fromJson(eventJson({'metadata': null}));
      final notAMap = PlanningEvent.fromJson(eventJson({'metadata': 'x'}));

      expect(missing.metadata, isEmpty);
      expect(explicitNull.metadata, isEmpty);
      expect(notAMap.metadata, isEmpty);
    });

    test('throws an explicit error on an unknown type', () {
      expect(
        () => PlanningEvent.fromJson(eventJson({'type': 'FOO'})),
        throwsA(
          isA<FormatException>().having(
            (error) => error.message,
            'message',
            contains('FOO'),
          ),
        ),
      );
      expect(
        () => PlanningEvent.fromJson(eventJson({'type': null})),
        throwsA(isA<FormatException>()),
      );
    });

    test('propagates an unknown type through the envelope', () {
      final envelope = sampleEnvelope();
      final planning = envelope['planning'] as Map<String, dynamic>;
      (planning['evenements'] as List).first['type'] = 'INCONNU';

      expect(
        () => Planning.fromEnvelope(envelope),
        throwsA(
          isA<FormatException>().having(
            (error) => error.message,
            'message',
            contains('INCONNU'),
          ),
        ),
      );
    });

    test('keeps null optional fields null', () {
      final event = PlanningEvent.fromJson(
        eventJson({
          'date': null,
          'time': null,
          'status': null,
          'resource_id': null,
          'metadata': null,
        }),
      );

      expect(event.date, isNull);
      expect(event.dateTime, isNull);
      expect(event.time, isNull);
      expect(event.status, isNull);
      expect(event.resourceId, isNull);
      expect(event.metadata, isEmpty);
    });

    test('reads resource_id whatever its type', () {
      final fromString =
          PlanningEvent.fromJson(eventJson({'resource_id': 'r-1'}));
      final fromNumber =
          PlanningEvent.fromJson(eventJson({'resource_id': 42}));

      expect(fromString.resourceId, 'r-1');
      expect(fromNumber.resourceId, '42');
    });
  });

  group('PlanningPagination', () {
    test('parses page, limit, total and pages', () {
      final pagination = PlanningPagination.fromJson(
        <String, dynamic>{'page': 2, 'limit': 50, 'total': 120, 'pages': 3},
      );

      expect(pagination.page, 2);
      expect(pagination.limit, 50);
      expect(pagination.total, 120);
      expect(pagination.pages, 3);
      expect(pagination.hasNextPage, isTrue);
    });

    test('accepts numeric strings', () {
      final pagination = PlanningPagination.fromJson(
        <String, dynamic>{'page': '2', 'limit': '50', 'total': '10', 'pages': '5'},
      );

      expect(pagination.page, 2);
      expect(pagination.limit, 50);
      expect(pagination.total, 10);
      expect(pagination.pages, 5);
    });

    test('applies the backend defaults when fields are missing', () {
      final pagination = PlanningPagination.fromJson(<String, dynamic>{});

      expect(pagination.page, 1);
      expect(pagination.limit, 100);
      expect(pagination.total, 0);
      expect(pagination.pages, 0);
      expect(pagination.hasNextPage, isFalse);
    });

    test('hasNextPage is false on the last page', () {
      const pagination = PlanningPagination(page: 3, limit: 10, total: 25, pages: 3);

      expect(pagination.hasNextPage, isFalse);
    });
  });

  group('Planning', () {
    test('parses an empty planning object', () {
      final planning = Planning.fromJson(<String, dynamic>{});

      expect(planning.stageId, isNull);
      expect(planning.periode, isNull);
      expect(planning.stages, isEmpty);
      expect(planning.horaire, isNull);
      expect(planning.evenements, isEmpty);
      expect(planning.reunions, isEmpty);
      expect(planning.taches, isEmpty);
      expect(planning.pointages, isEmpty);
      expect(planning.pagination.page, 1);
      expect(planning.pagination.limit, 100);
      expect(planning.pagination.total, 0);
      expect(planning.pagination.pages, 0);
    });

    test('keeps a null stage_id', () {
      final envelope = sampleEnvelope();
      final planning = envelope['planning'] as Map<String, dynamic>;
      planning['stage_id'] = null;

      expect(Planning.fromEnvelope(envelope).stageId, isNull);
    });

    test('ignores non object entries inside lists', () {
      final envelope = sampleEnvelope();
      final planning = envelope['planning'] as Map<String, dynamic>;
      planning['evenements'] = <Object>[
        ...planning['evenements'] as List,
        'not-an-object',
      ];

      final parsed = Planning.fromEnvelope(envelope);

      expect(parsed.evenements, hasLength(6));
    });
  });
}
