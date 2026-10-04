import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:steg_app/features/dashboard/domain/dashboard_repository.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/supervisor_info.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';

AppNotification buildNotification(String id, {bool lue = false}) {
  return AppNotification.fromJson({
    'id': id,
    'titre': 'Notification $id',
    'message': 'Message $id',
    'type': 'INFO',
    'lue': lue,
  });
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({
    DashboardStats? stats,
    this.taches = const [],
    this.reunions = const [],
    this.documents = const [],
    this.notifications = const [],
    this.supervisors = const [],
  }) : stats = stats ?? DashboardStats.fromJson({});

  DashboardStats stats;
  List<Tache> taches;
  List<Reunion> reunions;
  List<DocumentItem> documents;
  List<AppNotification> notifications;
  List<SupervisorInfo> supervisors;

  final List<String> markAsReadCalls = [];
  int markAllAsReadCalls = 0;
  int uploadCalls = 0;
  int deleteCalls = 0;

  @override
  Future<DashboardStats> getDashboardStats() async => stats;

  @override
  Future<List<Tache>> listTaches() async => List.of(taches);

  @override
  Future<List<Reunion>> listReunions() async => List.of(reunions);

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async =>
      List.of(documents);

  @override
  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    uploadCalls++;
    final document = DocumentItem.fromJson({
      'id': 'uploaded-$uploadCalls',
      'stage_id': stageId,
      'type': type,
      'nom': fileName ?? 'fichier.pdf',
    });
    documents = [document, ...documents];
    return document;
  }

  @override
  Future<Uint8List> downloadDocumentBytes({
    required String id,
    bool preview = false,
  }) async =>
      Uint8List(0);

  @override
  Future<Uint8List> downloadStagePdf({
    required String stageId,
    required String kind,
  }) async =>
      Uint8List(0);

  @override
  Future<void> deleteDocument(String id) async {
    deleteCalls++;
    documents = documents.where((d) => d.id != id).toList();
  }

  @override
  Future<List<Evaluation>> listEvaluations() async => const [];

  @override
  Future<List<AppNotification>> listNotifications() async => List.of(notifications);

  @override
  Future<int> unreadNotificationsCount() async =>
      notifications.where((n) => !n.lue).length;

  @override
  Future<void> markNotificationAsRead(String id) async => markAsReadCalls.add(id);

  @override
  Future<void> markAllNotificationsAsRead() async => markAllAsReadCalls++;

  @override
  Future<void> deleteNotification(String id) async {
    deleteCalls++;
    notifications = notifications.where((n) => n.id != id).toList();
  }

  @override
  Future<List<SupervisorInfo>> listSupervisors() async => List.of(supervisors);
}

void main() {
  ProviderContainer containerWith(FakeDashboardRepository repository) {
    final container = ProviderContainer(
      overrides: [
        dashboardRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('dashboardStatsProvider', () {
    test('loads the dashboard stats from the repository', () async {
      final repository = FakeDashboardRepository(
        stats: DashboardStats.fromJson({'notificationsNonLues': 3}),
      );
      final container = containerWith(repository);

      final stats = await container.read(dashboardStatsProvider.future);
      expect(stats.notificationsNonLues, 3);
    });
  });

  group('myDocumentsProvider', () {
    test('returns an empty list when there is no internship', () async {
      final repository = FakeDashboardRepository(
        stats: DashboardStats.fromJson({}),
        documents: [DocumentItem.fromJson({'id': 'd-1'})],
      );
      final container = containerWith(repository);

      expect(await container.read(myDocumentsProvider.future), isEmpty);
    });

    test('loads documents for the active internship', () async {
      final repository = FakeDashboardRepository(
        stats: DashboardStats.fromJson({
          'recentStages': [
            {'id': 'stage-1', 'statut': 'EN_COURS'},
          ],
        }),
        documents: [DocumentItem.fromJson({'id': 'd-1'})],
      );
      final container = containerWith(repository);

      final documents = await container.read(myDocumentsProvider.future);
      expect(documents.map((d) => d.id), ['d-1']);
    });
  });

  group('myNotificationsProvider', () {
    test('markAsRead updates the local list and notifies the repository', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2'),
        ],
      );
      final container = containerWith(repository);

      await container.read(myNotificationsProvider.future);
      await container.read(myNotificationsProvider.notifier).markAsRead('n1');

      final notifications = container.read(myNotificationsProvider).requireValue;
      expect(notifications[0].lue, isTrue);
      expect(notifications[1].lue, isFalse);
      expect(repository.markAsReadCalls, ['n1']);
    });

    test('markAllAsRead marks every notification as read', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2'),
        ],
      );
      final container = containerWith(repository);

      await container.read(myNotificationsProvider.future);
      await container.read(myNotificationsProvider.notifier).markAllAsRead();

      final notifications = container.read(myNotificationsProvider).requireValue;
      expect(notifications.every((n) => n.lue), isTrue);
      expect(repository.markAllAsReadCalls, 1);
    });

    test('unreadNotificationsProvider counts only unread notifications', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2', lue: true),
          buildNotification('n3'),
        ],
      );
      final container = containerWith(repository);

      await container.read(myNotificationsProvider.future);
      expect(container.read(unreadNotificationsProvider), 2);
    });
  });

  group('mySupervisorProvider', () {
    test('matches the summary with the supervisors list by id', () async {
      final repository = FakeDashboardRepository(
        stats: DashboardStats.fromJson({
          'topEncadrants': [
            {'encadrant_id': 'enc-1', 'nom': 'Ben Salah', 'prenom': 'Ahmed', 'nb_actifs': 2},
          ],
        }),
        supervisors: const [
          SupervisorInfo(
            id: 'enc-1',
            nom: 'Ben Salah',
            prenom: 'Ahmed',
            nbStagiairesActifs: 2,
            email: 'ahmed@steg.tn',
          ),
        ],
      );
      final container = containerWith(repository);

      await container.read(supervisorsProvider.future);
      await container.read(dashboardStatsProvider.future);
      final supervisor = container.read(mySupervisorProvider);

      expect(supervisor?.email, 'ahmed@steg.tn');
      expect(supervisor?.fullName, 'Ahmed Ben Salah');
    });

    test('falls back to the summary when no matching supervisor exists', () async {
      final repository = FakeDashboardRepository(
        stats: DashboardStats.fromJson({
          'topEncadrants': [
            {'encadrant_id': 'enc-9', 'nom': 'Ben Salah', 'prenom': 'Ahmed', 'nb_actifs': 2},
          ],
        }),
        supervisors: const [],
      );
      final container = containerWith(repository);

      await container.read(supervisorsProvider.future);
      await container.read(dashboardStatsProvider.future);
      final supervisor = container.read(mySupervisorProvider);

      expect(supervisor?.id, 'enc-9');
      expect(supervisor?.nbStagiairesActifs, 2);
    });

    test('is null without a supervisor summary', () async {
      final container = containerWith(FakeDashboardRepository());
      await container.read(supervisorsProvider.future);
      await container.read(dashboardStatsProvider.future);

      expect(container.read(mySupervisorProvider), isNull);
    });
  });

  group('tachesSectionsProvider', () {
    test('groups tasks by status in enum order', () async {
      final repository = FakeDashboardRepository(
        taches: [
          Tache.fromJson({'id': 't1', 'statut': 'TERMINEE'}),
          Tache.fromJson({'id': 't2', 'statut': 'A_FAIRE'}),
          Tache.fromJson({'id': 't3', 'statut': 'EN_COURS'}),
          Tache.fromJson({'id': 't4', 'statut': 'A_FAIRE'}),
        ],
      );
      final container = containerWith(repository);

      await container.read(myTachesProvider.future);
      final sections = container.read(tachesSectionsProvider);

      expect(sections.map((s) => s.status), TacheStatut.values);
      expect(sections[0].items.map((t) => t.id), ['t2', 't4']);
      expect(sections[2].items.map((t) => t.id), ['t1']);
    });

    test('drops tasks with an unknown status', () async {
      final repository = FakeDashboardRepository(
        taches: [
          Tache.fromJson({'id': 't1', 'statut': 'A_FAIRE'}),
          Tache.fromJson({'id': 't2', 'statut': 'AUTRE'}),
        ],
      );
      final container = containerWith(repository);

      await container.read(myTachesProvider.future);
      final sections = container.read(tachesSectionsProvider);

      final total = sections.fold<int>(0, (sum, s) => sum + s.items.length);
      expect(total, 1);
    });
  });
}
