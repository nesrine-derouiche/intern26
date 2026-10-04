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
import 'package:steg_app/models/personal_tache.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/pointage/pointage_providers.dart';
import 'package:steg_app/providers/personal_tache/personal_tache_providers.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/dashboard/intern_dashboard_screen.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import '../helpers/fake_pointage_repository.dart';
import 'package:steg_app/screens/dashboard/my_notifications_screen.dart';
import 'package:steg_app/screens/dashboard/my_tasks_screen.dart';
import 'package:steg_app/screens/home/home_stagiaire_view.dart';
import 'package:steg_app/widgets/dashboard/section_header.dart';

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

DashboardStats buildStats({bool withStage = true}) {
  return DashboardStats.fromJson({
    'notificationsNonLues': 2,
    'stagesTotal': withStage ? 1 : 0,
    'stagesEnCours': withStage ? 1 : 0,
    'tachesTotal': 2,
    'tachesAFaire': 1,
    'tachesEnCours': 1,
    'departements': [
      {'id': 'dept-1', 'nom': 'Informatique', 'nb_encadrants': '1', 'nb_stages_actifs': '1'},
    ],
    if (withStage)
      'recentStages': [
        {
          'id': 'stage-1',
          'date_debut': '2026-01-15',
          'date_fin': '2026-07-15',
          'statut': 'EN_COURS',
          'stagiaire_nom': 'Ben Ahmed',
          'stagiaire_prenom': 'Sami',
          'encadrant_nom': 'Ben Salah',
          'encadrant_prenom': 'Ahmed',
          'departement_nom': 'Informatique',
          'offre_titre': 'Développeur Angular',
        },
      ],
    'topEncadrants': [
      {'encadrant_id': 'enc-1', 'nom': 'Ben Salah', 'prenom': 'Ahmed', 'nb_stages': 1, 'nb_actifs': 1},
    ],
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
  FakeDashboardRepository({DashboardStats? stats, this.taches = const [], this.notifications = const []})
      : stats = stats ?? DashboardStats.fromJson({});

  DashboardStats stats;
  List<Tache> taches;
  List<AppNotification> notifications;

  @override
  Future<DashboardStats> getDashboardStats() async => stats;

  @override
  Future<List<Tache>> listTaches() async => List.of(taches);

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
    return DocumentItem.fromJson({
      'id': 'uploaded-1',
      'stage_id': stageId,
      'type': type,
      'nom': fileName ?? 'fichier.pdf',
    });
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
  Future<void> markNotificationAsRead(String id) async {}

  @override
  Future<void> markAllNotificationsAsRead() async {}

  @override
  Future<void> deleteNotification(String id) async {}

  @override
  Future<List<SupervisorInfo>> listSupervisors() async => const [
        SupervisorInfo(
          id: 'enc-1',
          nom: 'Ben Salah',
          prenom: 'Ahmed',
          nbStagiairesActifs: 1,
          email: 'ahmed@steg.tn',
        ),
      ];
}

ProviderScope buildApp({
  required FakeAuthRepository auth,
  required FakeDashboardRepository dashboard,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      dashboardRepositoryProvider.overrideWithValue(dashboard),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
      pointageRepositoryProvider.overrideWithValue(FakePointageRepository()),
      personalTachesProvider.overrideWith(FakePersonalTachesNotifier.new),
    ],
    child: const StegApp(),
  );
}

class FakePersonalTachesNotifier extends PersonalTachesNotifier {
  @override
  Future<List<PersonalTache>> build() async => [];
}

Future<void> goToDashboard(WidgetTester tester) async {
  final context = tester.element(find.byType(Scaffold).first);
  GoRouter.of(context).go(RoutePaths.internDashboard);
  await tester.pumpAndSettle();
}

FakeDashboardRepository buildDashboard() {
  return FakeDashboardRepository(
    stats: buildStats(),
    taches: [
      Tache.fromJson({
        'id': 't1',
        'titre': 'Rédiger le cahier des charges',
        'priorite': 'HAUTE',
        'statut': 'A_FAIRE',
        'progress': 0,
      }),
      Tache.fromJson({
        'id': 't2',
        'titre': "Développer l'API",
        'priorite': 'MOYENNE',
        'statut': 'EN_COURS',
        'progress': 40,
      }),
    ],
    notifications: [
      AppNotification.fromJson({
        'id': 'n1',
        'titre': 'Nouvelle tâche',
        'message': 'Une tâche vous a été assignée.',
        'type': 'TACHE',
        'lue': false,
      }),
      AppNotification.fromJson({
        'id': 'n2',
        'titre': 'Réunion planifiée',
        'message': 'Une réunion a été programmée.',
        'type': 'REUNION',
        'lue': true,
      }),
    ],
  );
}

void main() {
  testWidgets('home exposes the dashboard entry to a stagiaire only', (tester) async {
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
    expect(find.byType(HomeStagiaireView), findsOneWidget);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        dashboard: buildDashboard(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(HomeStagiaireView), findsNothing);
  });

  testWidgets('renders the internship overview from the dashboard stats', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
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

    await goToDashboard(tester);

    expect(find.byType(InternDashboardScreen), findsOneWidget);
    expect(find.text('Bonjour, Sami'), findsOneWidget);
    expect(find.text('Développeur Angular'), findsOneWidget);
    expect(find.text('En cours'), findsWidgets);
    expect(find.text('Ahmed Ben Salah'), findsWidgets);
    expect(find.text('Informatique'), findsWidgets);
    expect(find.text('Mes tâches'), findsOneWidget);
    expect(find.text('Mes réunions'), findsOneWidget);
    expect(find.text('Mes documents'), findsOneWidget);
    expect(find.text('Mes notifications'), findsOneWidget);
    expect(find.text('Rédiger le cahier des charges'), findsOneWidget);
  });

  testWidgets('navigates from the dashboard to the grouped tasks screen', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
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

    await goToDashboard(tester);

    final tasksHeader = find.ancestor(
      of: find.text('Mes tâches'),
      matching: find.byType(SectionHeader),
    );
    await tester.tap(find.descendant(of: tasksHeader, matching: find.text('Voir tout')));
    await tester.pumpAndSettle();

    expect(find.byType(MyTasksScreen), findsOneWidget);
    expect(find.text('À faire'), findsWidgets);
    expect(find.text('En cours'), findsWidgets);
    expect(find.text('Rédiger le cahier des charges'), findsOneWidget);
    expect(find.text("Développer l'API"), findsOneWidget);
  });

  testWidgets('marks all notifications as read from the notifications screen', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
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

    await goToDashboard(tester);

    final notificationsHeader = find.ancestor(
      of: find.text('Mes notifications'),
      matching: find.byType(SectionHeader),
    );
    await tester.tap(
      find.descendant(of: notificationsHeader, matching: find.text('Voir tout')),
    );
    await tester.pumpAndSettle();

    expect(find.byType(MyNotificationsScreen), findsOneWidget);
    expect(find.text('Nouvelle tâche'), findsOneWidget);
    expect(find.text('Tout marquer lu'), findsOneWidget);

    await tester.tap(find.text('Tout marquer lu'));
    await tester.pumpAndSettle();

    expect(find.text('Tout marquer lu'), findsNothing);
  });

  testWidgets('shows a hint when the stagiaire has no internship', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        dashboard: FakeDashboardRepository(
          stats: buildStats(withStage: false),
          notifications: buildDashboard().notifications,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await goToDashboard(tester);

    expect(
      find.text(
        'Aucun stage trouvé. Les informations apparaîtront une fois votre stage validé.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('blocks non-stagiaire roles on the dashboard screen', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(
            FakeAuthRepository(
              session: const AuthSession(accessToken: 'token', user: admin),
            ),
          ),
          dashboardRepositoryProvider.overrideWithValue(buildDashboard()),
          stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
          pointageRepositoryProvider.overrideWithValue(FakePointageRepository()),
        ],
        child: const MaterialApp(home: InternDashboardScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tableau de bord indisponible'), findsOneWidget);
  });
}
