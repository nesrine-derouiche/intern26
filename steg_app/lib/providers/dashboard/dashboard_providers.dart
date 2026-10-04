import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/dashboard/data/dashboard_repository_impl.dart';
import '../../features/dashboard/domain/dashboard_repository.dart';
import '../../features/dashboard/domain/usecases/delete_notification_usecase.dart';
import '../../features/dashboard/domain/usecases/delete_document_usecase.dart';
import '../../features/dashboard/domain/usecases/download_document_usecase.dart';
import '../../features/dashboard/domain/usecases/download_stage_pdf_usecase.dart';
import '../../features/dashboard/domain/usecases/get_dashboard_stats_usecase.dart';
import '../../features/dashboard/domain/usecases/get_documents_usecase.dart';
import '../../features/dashboard/domain/usecases/get_evaluations_usecase.dart';
import '../../features/dashboard/domain/usecases/get_notifications_usecase.dart';
import '../../features/dashboard/domain/usecases/get_reunions_usecase.dart';
import '../../features/dashboard/domain/usecases/get_supervisors_usecase.dart';
import '../../features/dashboard/domain/usecases/get_taches_usecase.dart';
import '../../features/dashboard/domain/usecases/get_unread_notifications_count_usecase.dart';
import '../../features/dashboard/domain/usecases/mark_all_notifications_as_read_usecase.dart';
import '../../features/dashboard/domain/usecases/mark_notification_as_read_usecase.dart';
import '../../features/dashboard/domain/usecases/upload_document_usecase.dart';
import '../../models/app_notification.dart';
import '../../models/calendar_event.dart';
import '../../models/stagiaire_calendar_event.dart';
import '../stagiaire/stagiaire_calendar_provider.dart';
import '../../models/dashboard_stats.dart';
import '../../models/document_item.dart';
import '../../models/evaluation.dart';
import '../../models/notification_category.dart';
import '../../models/reunion.dart';
import '../../models/supervisor_info.dart';
import '../../models/tache.dart';
import '../../services/dashboard_service.dart';
import '../../services/document_service.dart';
import '../../services/encadrant_service.dart';
import '../../services/evaluation_service.dart';
import '../../services/notification_service.dart';
import '../../services/reunion_service.dart';
import '../../services/tache_service.dart';
import '../core/api_client_provider.dart';

final dashboardServiceProvider = Provider<DashboardService>(
  (ref) => DashboardService(ref.watch(dioProvider)),
);

final tacheServiceProvider = Provider<TacheService>(
  (ref) => TacheService(ref.watch(dioProvider)),
);

final reunionServiceProvider = Provider<ReunionService>(
  (ref) => ReunionService(ref.watch(dioProvider)),
);

final documentServiceProvider = Provider<DocumentService>(
  (ref) => DocumentService(ref.watch(dioProvider)),
);

final notificationServiceProvider = Provider<NotificationService>(
  (ref) => NotificationService(ref.watch(dioProvider)),
);

final encadrantServiceProvider = Provider<EncadrantService>(
  (ref) => EncadrantService(ref.watch(dioProvider)),
);

final evaluationServiceProvider = Provider<EvaluationService>(
  (ref) => EvaluationService(ref.watch(dioProvider)),
);

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => DashboardRepositoryImpl(
    dashboardService: ref.watch(dashboardServiceProvider),
    tacheService: ref.watch(tacheServiceProvider),
    reunionService: ref.watch(reunionServiceProvider),
    documentService: ref.watch(documentServiceProvider),
    notificationService: ref.watch(notificationServiceProvider),
    encadrantService: ref.watch(encadrantServiceProvider),
    evaluationService: ref.watch(evaluationServiceProvider),
  ),
);

final getDashboardStatsUseCaseProvider = Provider<GetDashboardStatsUseCase>(
  (ref) => GetDashboardStatsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getTachesUseCaseProvider = Provider<GetTachesUseCase>(
  (ref) => GetTachesUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getReunionsUseCaseProvider = Provider<GetReunionsUseCase>(
  (ref) => GetReunionsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getDocumentsUseCaseProvider = Provider<GetDocumentsUseCase>(
  (ref) => GetDocumentsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final uploadDocumentUseCaseProvider = Provider<UploadDocumentUseCase>(
  (ref) => UploadDocumentUseCase(ref.watch(dashboardRepositoryProvider)),
);

final downloadDocumentUseCaseProvider = Provider<DownloadDocumentUseCase>(
  (ref) => DownloadDocumentUseCase(ref.watch(dashboardRepositoryProvider)),
);

final downloadStagePdfUseCaseProvider = Provider<DownloadStagePdfUseCase>(
  (ref) => DownloadStagePdfUseCase(ref.watch(dashboardRepositoryProvider)),
);

final deleteDocumentUseCaseProvider = Provider<DeleteDocumentUseCase>(
  (ref) => DeleteDocumentUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getNotificationsUseCaseProvider = Provider<GetNotificationsUseCase>(
  (ref) => GetNotificationsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getSupervisorsUseCaseProvider = Provider<GetSupervisorsUseCase>(
  (ref) => GetSupervisorsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getEvaluationsUseCaseProvider = Provider<GetEvaluationsUseCase>(
  (ref) => GetEvaluationsUseCase(ref.watch(dashboardRepositoryProvider)),
);

final markNotificationAsReadUseCaseProvider = Provider<MarkNotificationAsReadUseCase>(
  (ref) => MarkNotificationAsReadUseCase(ref.watch(dashboardRepositoryProvider)),
);

final markAllNotificationsAsReadUseCaseProvider =
    Provider<MarkAllNotificationsAsReadUseCase>(
  (ref) => MarkAllNotificationsAsReadUseCase(ref.watch(dashboardRepositoryProvider)),
);

final deleteNotificationUseCaseProvider = Provider<DeleteNotificationUseCase>(
  (ref) => DeleteNotificationUseCase(ref.watch(dashboardRepositoryProvider)),
);

final getUnreadNotificationsCountUseCaseProvider =
    Provider<GetUnreadNotificationsCountUseCase>(
  (ref) => GetUnreadNotificationsCountUseCase(ref.watch(dashboardRepositoryProvider)),
);

final dashboardStatsProvider =
    AsyncNotifierProvider<DashboardStatsNotifier, DashboardStats>(
  DashboardStatsNotifier.new,
);

class DashboardStatsNotifier extends AsyncNotifier<DashboardStats> {
  @override
  Future<DashboardStats> build() {
    return ref.read(getDashboardStatsUseCaseProvider).call();
  }
}

final myTachesProvider = AsyncNotifierProvider<MyTachesNotifier, List<Tache>>(
  MyTachesNotifier.new,
);

class MyTachesNotifier extends AsyncNotifier<List<Tache>> {
  @override
  Future<List<Tache>> build() {
    return ref.read(getTachesUseCaseProvider).call();
  }
}

final myReunionsProvider = AsyncNotifierProvider<MyReunionsNotifier, List<Reunion>>(
  MyReunionsNotifier.new,
);

class MyReunionsNotifier extends AsyncNotifier<List<Reunion>> {
  @override
  Future<List<Reunion>> build() {
    return ref.read(getReunionsUseCaseProvider).call();
  }
}

final supervisorsProvider =
    AsyncNotifierProvider<SupervisorsNotifier, List<SupervisorInfo>>(
  SupervisorsNotifier.new,
);

class SupervisorsNotifier extends AsyncNotifier<List<SupervisorInfo>> {
  @override
  Future<List<SupervisorInfo>> build() {
    return ref.read(getSupervisorsUseCaseProvider).call();
  }
}

final myDocumentsProvider =
    AsyncNotifierProvider<MyDocumentsNotifier, List<DocumentItem>>(
  MyDocumentsNotifier.new,
);

class MyDocumentsNotifier extends AsyncNotifier<List<DocumentItem>> {
  @override
  Future<List<DocumentItem>> build() async {
    final stats = await ref.watch(dashboardStatsProvider.future);
    final internship = stats.internship;
    if (internship == null) return const <DocumentItem>[];
    return ref.read(getDocumentsUseCaseProvider).call(stageId: internship.id);
  }

  Future<String?> _activeStageId() async {
    final stats = await ref.read(dashboardStatsProvider.future);
    return stats.internship?.id;
  }

  Future<DocumentItem> upload({
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    final stageId = await _activeStageId();
    if (stageId == null) {
      throw StateError('Aucun stage actif pour déposer un document.');
    }
    final document = await ref.read(uploadDocumentUseCaseProvider).call(
          stageId: stageId,
          type: type,
          filePath: filePath,
          fileName: fileName,
        );
    final current = state.value;
    if (current != null) {
      state = AsyncData([document, ...current]);
    }
    return document;
  }

  Future<void> delete(String id) async {
    await ref.read(deleteDocumentUseCaseProvider).call(id);
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.where((d) => d.id != id).toList());
  }
}

final myEvaluationsProvider =
    AsyncNotifierProvider<MyEvaluationsNotifier, List<Evaluation>>(
  MyEvaluationsNotifier.new,
);

class MyEvaluationsNotifier extends AsyncNotifier<List<Evaluation>> {
  @override
  Future<List<Evaluation>> build() {
    return ref.read(getEvaluationsUseCaseProvider).call();
  }
}

final myNotificationsProvider =
    AsyncNotifierProvider<MyNotificationsNotifier, List<AppNotification>>(
  MyNotificationsNotifier.new,
);

class MyNotificationsNotifier extends AsyncNotifier<List<AppNotification>> {
  @override
  Future<List<AppNotification>> build() {
    return ref.read(getNotificationsUseCaseProvider).call();
  }

  Future<void> markAsRead(String id) async {
    await ref.read(markNotificationAsReadUseCaseProvider).call(id);
    final current = state.value;
    if (current == null) return;
    state = AsyncData([
      for (final notification in current)
        notification.id == id ? notification.copyWith(lue: true) : notification,
    ]);
    ref.invalidate(unreadCountProvider);
  }

  Future<void> markAllAsRead() async {
    await ref.read(markAllNotificationsAsReadUseCaseProvider).call();
    final current = state.value;
    if (current == null) return;
    state = AsyncData([
      for (final notification in current) notification.copyWith(lue: true),
    ]);
    ref.invalidate(unreadCountProvider);
  }

  Future<void> delete(String id) async {
    await ref.read(deleteNotificationUseCaseProvider).call(id);
    final current = state.value;
    if (current == null) return;
    state = AsyncData(current.where((n) => n.id != id).toList());
    ref.invalidate(unreadCountProvider);
  }
}

final unreadNotificationsProvider = Provider<int>((ref) {
  final notifications = ref.watch(myNotificationsProvider).value ?? const <AppNotification>[];
  return notifications.where((notification) => !notification.lue).length;
});

final unreadCountProvider =
    AsyncNotifierProvider<UnreadCountNotifier, int>(UnreadCountNotifier.new);

class UnreadCountNotifier extends AsyncNotifier<int> {
  @override
  Future<int> build() {
    return ref.read(getUnreadNotificationsCountUseCaseProvider).call();
  }
}

final notificationTypeFilterProvider =
    NotifierProvider<NotificationTypeFilter, NotificationCategory?>(
  NotificationTypeFilter.new,
);

class NotificationTypeFilter extends Notifier<NotificationCategory?> {
  @override
  NotificationCategory? build() => null;

  void select(NotificationCategory? category) => state = category;
}

final mySupervisorProvider = Provider<SupervisorInfo?>((ref) {
  final supervisors = ref.watch(supervisorsProvider).value ?? const <SupervisorInfo>[];
  final stats = ref.watch(dashboardStatsProvider).value;
  final summary = stats?.supervisor;
  if (summary == null) return null;

  for (final supervisor in supervisors) {
    if (supervisor.id == summary.encadrantId) return supervisor;
  }

  return SupervisorInfo(
    id: summary.encadrantId,
    nom: summary.nom,
    prenom: summary.prenom,
    nbStagiairesActifs: summary.nbActifs,
  );
});

class TacheSection {
  const TacheSection({required this.status, required this.items});

  final TacheStatut status;
  final List<Tache> items;
}

final tachesSectionsProvider = Provider<List<TacheSection>>((ref) {
  final taches = ref.watch(myTachesProvider).value ?? const <Tache>[];
  final groups = <String, List<Tache>>{};
  for (final tache in taches) {
    groups.putIfAbsent(tache.statut, () => []).add(tache);
  }

  return [
    for (final status in TacheStatut.values)
      TacheSection(status: status, items: groups[status.value] ?? const []),
  ];
});

final calendarEventsProvider =
    AsyncNotifierProvider<CalendarEventsNotifier, List<CalendarEvent>>(
  CalendarEventsNotifier.new,
);

class CalendarEventsNotifier extends AsyncNotifier<List<CalendarEvent>> {
  @override
  Future<List<CalendarEvent>> build() async {
    final service = ref.read(stagiaireCalendarServiceProvider);
    final rawEvents = await service.getCalendarEvents();
    return rawEvents
        .map((e) => CalendarEvent(
              id: e.id,
              type: _mapType(e.type),
              title: e.title,
              date: e.date,
              time: e.time,
              allDay: e.time == null,
              description: e.status,
              location: e.resourceId,
            ))
        .where((e) => e.day != null)
        .toList()
      ..sort((a, b) => (a.day ?? DateTime(2100)).compareTo(b.day ?? DateTime(2100)));
  }

  static CalendarEventType _mapType(StagiaireCalendarEventType type) {
    return switch (type) {
      StagiaireCalendarEventType.meeting => CalendarEventType.reunion,
      StagiaireCalendarEventType.task => CalendarEventType.tacheEcheance,
      StagiaireCalendarEventType.internship => CalendarEventType.stageDebut,
    };
  }
}
