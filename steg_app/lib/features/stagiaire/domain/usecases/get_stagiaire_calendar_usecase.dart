import '../../../../models/stagiaire_calendar_event.dart';
import '../stagiaire_calendar_repository.dart';

class GetStagiaireCalendarUseCase {
  GetStagiaireCalendarUseCase(this._repository);

  final StagiaireCalendarRepository _repository;

  Future<List<StagiaireCalendarEvent>> call() =>
      _repository.getCalendarEvents();
}
