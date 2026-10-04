import '../../models/calendar_event.dart';

const List<String> weekdayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const List<String> weekdayNamesFr = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

const List<String> monthNamesFr = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

Map<DateTime, List<CalendarEvent>> groupEventsByDay(
  List<CalendarEvent> events,
) {
  final map = <DateTime, List<CalendarEvent>>{};
  for (final event in events) {
    final day = event.day;
    if (day == null) continue;
    map.putIfAbsent(day, () => []).add(event);
  }
  return map;
}

List<CalendarEvent> eventsOnDay(
  Map<DateTime, List<CalendarEvent>> byDay,
  DateTime day,
) {
  final key = DateTime(day.year, day.month, day.day);
  return byDay[key] ?? const <CalendarEvent>[];
}
