import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/calendar_event.dart';
import 'package:steg_app/models/stagiaire_calendar_event.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_calendar_provider.dart';
import 'package:steg_app/services/stagiaire_calendar_service.dart';

class FakeStagiaireCalendarService implements StagiaireCalendarService {
  FakeStagiaireCalendarService({this.events = const []});

  List<StagiaireCalendarEvent> events;

  @override
  Future<List<StagiaireCalendarEvent>> getCalendarEvents() async =>
      List.of(events);
}

List<StagiaireCalendarEvent> buildSampleEvents() {
  return [
    const StagiaireCalendarEvent(
      id: 'stage-debut-s1',
      type: StagiaireCalendarEventType.internship,
      title: 'Début du stage',
      date: null,
      status: 'EN_COURS',
      resourceId: 's1',
    ),
    const StagiaireCalendarEvent(
      id: 'reunion-r1',
      type: StagiaireCalendarEventType.meeting,
      title: 'Point projet',
      date: null,
      time: '10:30:00',
      status: null,
      resourceId: 'r1',
    ),
  ];
}

void main() {
  group('calendarEventsProvider', () {
    test('maps stagiaire calendar events to CalendarEvent list', () async {
      final today = DateTime.now();
      final service = FakeStagiaireCalendarService(
        events: [
          StagiaireCalendarEvent(
            id: 'stage-debut-s1',
            type: StagiaireCalendarEventType.internship,
            title: 'Début du stage',
            date: today,
            status: 'EN_COURS',
            resourceId: 's1',
          ),
          StagiaireCalendarEvent(
            id: 'reunion-r1',
            type: StagiaireCalendarEventType.meeting,
            title: 'Point projet',
            date: today.add(const Duration(days: 5)),
            time: '10:30',
            status: null,
            resourceId: 'r1',
          ),
          StagiaireCalendarEvent(
            id: 'tache-t1',
            type: StagiaireCalendarEventType.task,
            title: 'Valider le module',
            date: today.add(const Duration(days: 10)),
            status: 'EN_COURS',
            resourceId: 't1',
          ),
        ],
      );

      final container = ProviderContainer(
        overrides: [
          stagiaireCalendarServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);

      final events = await container.read(calendarEventsProvider.future);

      expect(events, hasLength(3));
      expect(events[0].type, CalendarEventType.stageDebut);
      expect(events[1].type, CalendarEventType.reunion);
      expect(events[2].type, CalendarEventType.tacheEcheance);

      final ids = events.map((e) => e.id).toSet();
      expect(ids.length, events.length);
    });

    test('is empty when no backend events', () async {
      final service = FakeStagiaireCalendarService(events: []);

      final container = ProviderContainer(
        overrides: [
          stagiaireCalendarServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);

      final events = await container.read(calendarEventsProvider.future);
      expect(events, isEmpty);
    });

    test('sorts events chronologically', () async {
      final today = DateTime.now();
      final service = FakeStagiaireCalendarService(
        events: [
          StagiaireCalendarEvent(
            id: 'late',
            type: StagiaireCalendarEventType.task,
            title: 'Late',
            date: today.add(const Duration(days: 20)),
            resourceId: 't1',
          ),
          StagiaireCalendarEvent(
            id: 'early',
            type: StagiaireCalendarEventType.meeting,
            title: 'Early',
            date: today,
            time: '09:00',
            resourceId: 'r1',
          ),
          StagiaireCalendarEvent(
            id: 'mid',
            type: StagiaireCalendarEventType.internship,
            title: 'Mid',
            date: today.add(const Duration(days: 10)),
            resourceId: 's1',
          ),
        ],
      );

      final container = ProviderContainer(
        overrides: [
          stagiaireCalendarServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);

      final events = await container.read(calendarEventsProvider.future);

      expect(events.map((e) => e.id), ['early', 'mid', 'late']);
    });

    test('drops events without dates', () async {
      final service = FakeStagiaireCalendarService(
        events: [
          const StagiaireCalendarEvent(
            id: 'no-date',
            type: StagiaireCalendarEventType.meeting,
            title: 'No date',
            date: null,
            resourceId: 'r1',
          ),
          StagiaireCalendarEvent(
            id: 'has-date',
            type: StagiaireCalendarEventType.task,
            title: 'Has date',
            date: DateTime.now(),
            resourceId: 't1',
          ),
        ],
      );

      final container = ProviderContainer(
        overrides: [
          stagiaireCalendarServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);

      final events = await container.read(calendarEventsProvider.future);
      expect(events, hasLength(1));
      expect(events.first.id, 'has-date');
    });
  });
}
