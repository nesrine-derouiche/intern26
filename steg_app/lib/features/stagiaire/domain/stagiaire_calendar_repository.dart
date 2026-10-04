import '../../../models/stagiaire_calendar_event.dart';

abstract interface class StagiaireCalendarRepository {
  Future<List<StagiaireCalendarEvent>> getCalendarEvents();
}
