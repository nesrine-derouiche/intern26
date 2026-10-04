import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/stagiaire/data/stagiaire_calendar_repository_impl.dart';
import '../../features/stagiaire/domain/stagiaire_calendar_repository.dart';
import '../../features/stagiaire/domain/usecases/get_stagiaire_calendar_usecase.dart';
import '../../models/stagiaire_calendar_event.dart';
import '../../services/stagiaire_calendar_service.dart';
import '../core/api_client_provider.dart';

final stagiaireCalendarServiceProvider = Provider<StagiaireCalendarService>(
  (ref) => StagiaireCalendarService(ref.watch(dioProvider)),
);

final stagiaireCalendarRepositoryProvider =
    Provider<StagiaireCalendarRepository>(
  (ref) => StagiaireCalendarRepositoryImpl(
    ref.watch(stagiaireCalendarServiceProvider),
  ),
);

final getStagiaireCalendarUseCaseProvider =
    Provider<GetStagiaireCalendarUseCase>(
  (ref) => GetStagiaireCalendarUseCase(
    ref.watch(stagiaireCalendarRepositoryProvider),
  ),
);

final stagiaireCalendarProvider =
    AsyncNotifierProvider<StagiaireCalendarNotifier, List<StagiaireCalendarEvent>>(
  StagiaireCalendarNotifier.new,
);

class StagiaireCalendarNotifier
    extends AsyncNotifier<List<StagiaireCalendarEvent>> {
  @override
  Future<List<StagiaireCalendarEvent>> build() {
    return ref.read(getStagiaireCalendarUseCaseProvider).call();
  }
}
