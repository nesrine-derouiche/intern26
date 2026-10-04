import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:steg_app/features/dashboard/domain/dashboard_repository.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart';
import 'package:steg_app/models/notification_category.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/supervisor_info.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';

AppNotification buildNotification(
  String id, {
  bool lue = false,
  String type = 'INFO',
}) {
  return AppNotification.fromJson({
    'id': id,
    'titre': 'Notification $id',
    'message': 'Message $id',
    'type': type,
    'lue': lue,
  });
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({this.notifications = const []});

  List<AppNotification> notifications;

  int unreadCountCalls = 0;
  int deleteCalls = 0;

  @override
  Future<DashboardStats> getDashboardStats() async => DashboardStats.fromJson({});

  @override
  Future<List<Tache>> listTaches() async => const [];

  @override
  Future<List<Reunion>> listReunions() async => const [];

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async => const [];

  @override
  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    throw UnimplementedError();
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
  Future<void> deleteDocument(String id) async {}

  @override
  Future<List<Evaluation>> listEvaluations() async => const [];

  @override
  Future<List<AppNotification>> listNotifications() async => List.of(notifications);

  @override
  Future<int> unreadNotificationsCount() async {
    unreadCountCalls++;
    return notifications.where((n) => !n.lue).length;
  }

  @override
  Future<void> markNotificationAsRead(String id) async {
    notifications = [
      for (final n in notifications)
        n.id == id ? n.copyWith(lue: true) : n,
    ];
  }

  @override
  Future<void> markAllNotificationsAsRead() async {
    notifications = [for (final n in notifications) n.copyWith(lue: true)];
  }

  @override
  Future<void> deleteNotification(String id) async {
    deleteCalls++;
    notifications = notifications.where((n) => n.id != id).toList();
  }

  @override
  Future<List<SupervisorInfo>> listSupervisors() async => const [];
}

ProviderContainer containerWith(FakeDashboardRepository repository) {
  final container = ProviderContainer(
    overrides: [
      dashboardRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('unreadCountProvider', () {
    test('loads the unread count from the repository', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2', lue: true),
          buildNotification('n3'),
        ],
      );
      final container = containerWith(repository);

      expect(await container.read(unreadCountProvider.future), 2);
      expect(repository.unreadCountCalls, 1);
    });

    test('is refreshed after marking a notification as read', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2'),
        ],
      );
      final container = containerWith(repository);
      await container.read(myNotificationsProvider.future);
      await container.read(unreadCountProvider.future);

      await container.read(myNotificationsProvider.notifier).markAsRead('n1');

      expect(await container.read(unreadCountProvider.future), 1);
    });
  });

  group('myNotificationsProvider.delete', () {
    test('removes the notification locally and notifies the repository', () async {
      final repository = FakeDashboardRepository(
        notifications: [
          buildNotification('n1'),
          buildNotification('n2'),
        ],
      );
      final container = containerWith(repository);

      await container.read(myNotificationsProvider.future);
      await container.read(myNotificationsProvider.notifier).delete('n1');

      final notifications = container.read(myNotificationsProvider).requireValue;
      expect(notifications.map((n) => n.id), ['n2']);
      expect(repository.deleteCalls, 1);
    });
  });

  group('notificationTypeFilterProvider', () {
    test('starts with no filter and selects a category', () {
      final container = containerWith(FakeDashboardRepository());

      expect(container.read(notificationTypeFilterProvider), isNull);

      container
          .read(notificationTypeFilterProvider.notifier)
          .select(NotificationCategory.reunions);
      expect(container.read(notificationTypeFilterProvider), NotificationCategory.reunions);

      container.read(notificationTypeFilterProvider.notifier).select(null);
      expect(container.read(notificationTypeFilterProvider), isNull);
    });
  });
}
