import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:go_router/go_router.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/dashboard/domain/dashboard_repository.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/supervisor_info.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/push/push_provider.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/dashboard/my_notifications_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import 'package:steg_app/screens/home/home_stagiaire_view.dart';
import 'package:steg_app/widgets/dashboard/notification_card.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

AppNotification buildNotification(
  String id, {
  bool lue = false,
  String type = 'INFO',
  String? date,
}) {
  return AppNotification.fromJson({
    'id': id,
    'titre': 'Notification $id',
    'message': 'Message $id',
    'type': type,
    'lue': lue,
    'date': ?date,
  });
}

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({this.notifications = const []});

  List<AppNotification> notifications;

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
  Future<int> unreadNotificationsCount() async =>
      notifications.where((n) => !n.lue).length;

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
    notifications = notifications.where((n) => n.id != id).toList();
  }

  @override
  Future<List<SupervisorInfo>> listSupervisors() async => const [];
}

Widget buildApp({
  required FakeAuthRepository auth,
  required FakeDashboardRepository dashboard,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      dashboardRepositoryProvider.overrideWithValue(dashboard),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
    ],
    child: const StegApp(),
  );
}

Widget buildScreen(FakeDashboardRepository dashboard) {
  return ProviderScope(
    overrides: [
      dashboardRepositoryProvider.overrideWithValue(dashboard),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
    ],
    child: const MaterialApp(home: MyNotificationsScreen()),
  );
}

FakeDashboardRepository buildDashboard() {
  return FakeDashboardRepository(
    notifications: [
      buildNotification('n1', type: 'REUNION', date: '2026-07-30T09:00:00.000Z'),
      buildNotification('n2', type: 'TACHE', date: '2026-07-29T09:00:00.000Z'),
      buildNotification('n3', type: 'REUNION', date: '2026-07-28T09:00:00.000Z', lue: true),
    ],
  );
}

void main() {
  testWidgets('home exposes the notifications entry with an unread badge to all roles',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = FakeDashboardRepository(
      notifications: [buildNotification('n1'), buildNotification('n2', lue: true)],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        dashboard: dashboard,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Notifications'), findsWidgets);

    final context = tester.element(find.byType(Scaffold).first);
    GoRouter.of(context).go(RoutePaths.mesNotifications);
    await tester.pumpAndSettle();

    expect(find.byType(MyNotificationsScreen), findsOneWidget);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        dashboard: dashboard,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Notifications'), findsWidgets);
  });

  testWidgets('renders the notification center with a summary and category chips',
      (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildScreen(buildDashboard()));
    await tester.pumpAndSettle();

    expect(find.text('Centre de notifications'), findsOneWidget);
    expect(find.text('2 non lues · 3 au total'), findsOneWidget);
    expect(find.byType(ChoiceChip), findsWidgets);
    expect(find.text('Notification n1'), findsOneWidget);
    expect(find.text('Notification n2'), findsOneWidget);
    expect(find.text('Notification n3'), findsOneWidget);
    expect(find.text('Tout marquer lu'), findsOneWidget);
  });

  testWidgets('category chips narrow the list to the selected category', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(buildScreen(buildDashboard()));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ChoiceChip, 'Réunions'));
    await tester.pumpAndSettle();

    expect(find.text('Notification n1'), findsOneWidget);
    expect(find.text('Notification n3'), findsOneWidget);
    expect(find.text('Notification n2'), findsNothing);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Tâches'));
    await tester.pumpAndSettle();

    expect(find.text('Notification n2'), findsOneWidget);
    expect(find.text('Notification n1'), findsNothing);
  });

  testWidgets('tapping an unread notification marks it read and opens the details sheet',
      (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = buildDashboard();
    await tester.pumpWidget(buildScreen(dashboard));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Notification n1'));
    await tester.pumpAndSettle();

    expect(dashboard.notifications.first.lue, isTrue);
    expect(find.text('Message n1'), findsWidgets);
    expect(find.byType(BottomSheet), findsOneWidget);

    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
  });

  testWidgets('swipe to delete removes a notification after confirmation', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = buildDashboard();
    await tester.pumpWidget(buildScreen(dashboard));
    await tester.pumpAndSettle();

    expect(find.byType(NotificationCard), findsNWidgets(3));

    await tester.drag(find.text('Notification n2'), const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(find.text('Supprimer la notification ?'), findsOneWidget);

    await tester.tap(find.text('Supprimer'));
    await tester.pumpAndSettle();

    expect(dashboard.notifications.map((n) => n.id), isNot(contains('n2')));
    expect(find.byType(NotificationCard), findsNWidgets(2));
    expect(find.text('Notification n2'), findsNothing);
  });

  testWidgets('marking all notifications as read hides the action', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dashboard = buildDashboard();
    await tester.pumpWidget(buildScreen(dashboard));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tout marquer lu'));
    await tester.pumpAndSettle();

    expect(find.text('Tout marquer lu'), findsNothing);
    expect(find.text('3 notifications'), findsOneWidget);
  });

  testWidgets('push controller degrades gracefully without Firebase configuration',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        dashboard: buildDashboard(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Notifications'), findsWidgets);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(HomeScreen)),
      listen: false,
    );
    final pushState = container.read(pushControllerProvider).value;
    expect(pushState?.supported, isFalse);
    expect(pushState?.tokenRegistered, isFalse);
  });
}
