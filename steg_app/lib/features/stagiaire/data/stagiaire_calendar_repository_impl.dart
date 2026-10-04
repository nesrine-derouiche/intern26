import '../../../models/stagiaire_calendar_event.dart';
import '../../../services/stagiaire_calendar_service.dart';
import '../domain/stagiaire_calendar_repository.dart';

class StagiaireCalendarRepositoryImpl implements StagiaireCalendarRepository {
  StagiaireCalendarRepositoryImpl(this._service);

  final StagiaireCalendarService _service;

  @override
  Future<List<StagiaireCalendarEvent>> getCalendarEvents() =>
      _service.getCalendarEvents();
}
