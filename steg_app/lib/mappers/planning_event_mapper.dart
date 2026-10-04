import '../models/calendar_event.dart';
import '../models/planning.dart';

class PlanningEventMapper {
  static CalendarEventType mapType(PlanningEventType type) {
    return switch (type) {
      PlanningEventType.stageStart => CalendarEventType.stageDebut,
      PlanningEventType.stageEnd => CalendarEventType.stageFin,
      PlanningEventType.reunion => CalendarEventType.reunion,
      PlanningEventType.taskDeadline => CalendarEventType.tacheEcheance,
      PlanningEventType.pointageEntree => CalendarEventType.pointageEntree,
      PlanningEventType.pointageSortie => CalendarEventType.pointageSortie,
    };
  }

  static CalendarEvent toCalendarEvent(PlanningEvent event) {
    return CalendarEvent(
      id: event.id,
      type: mapType(event.type),
      title: event.title,
      description: event.status,
      location: event.resourceId,
      time: event.time,
      date: event.dateTime,
      allDay: event.time == null,
    );
  }

  static List<CalendarEvent> toCalendarEvents(Iterable<PlanningEvent> events) {
    return events.map(toCalendarEvent).toList();
  }
}
