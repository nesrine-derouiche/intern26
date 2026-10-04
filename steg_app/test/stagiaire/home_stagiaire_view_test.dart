import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:go_router/go_router.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/dashboard/domain/dashboard_repository.dart';
import 'package:steg_app/features/stagiaire/domain/stagiaire_overview_repository.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart' as models;
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/stagiaire_overview.dart';
import 'package:steg_app/models/supervisor_info.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/pointage/pointage_providers.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import 'package:steg_app/widgets/common/skeleton_card.dart';
import '../helpers/fake_pointage_repository.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});
  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async => throw UnimplementedError();

  @override
  Future<void> logout() async => session = null;
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({DashboardStats? stats})
      : stats = stats ?? DashboardStats.fromJson({});

  DashboardStats stats;

  @override
  Future<DashboardStats> getDashboardStats() async => stats;
  @override
  Future<List<Tache>> listTaches() async => const [];
  @override
  Future<List<Reunion>> listReunions() async => const [];
  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async => const [];
  @override
  Future<DocumentItem> uploadDocument({required String stageId, required String type, required String filePath, String? fileName}) async => throw UnimplementedError();
  @override
  Future<Uint8List> downloadDocumentBytes({required String id, bool preview = false}) async => Uint8List(0);
  @override
  Future<Uint8List> downloadStagePdf({required String stageId, required String kind}) async => Uint8List(0);
  @override
  Future<void> deleteDocument(String id) async {}
  @override
  Future<List<models.Evaluation>> listEvaluations() async => const [];
  @override
  Future<List<AppNotification>> listNotifications() async => const [];
  @override
  Future<int> unreadNotificationsCount() async => 0;
  @override
  Future<void> markNotificationAsRead(String id) async {}
  @override
  Future<void> markAllNotificationsAsRead() async {}
  @override
  Future<void> deleteNotification(String id) async {}
  @override
  Future<List<SupervisorInfo>> listSupervisors() async => const [];
}

class FakeStagiaireOverviewRepository implements StagiaireOverviewRepository {
  FakeStagiaireOverviewRepository({this.overview, this.shouldFail = false});
  StagiaireOverview? overview;
  bool shouldFail;

  @override
  Future<StagiaireOverview> getOverview() async {
    if (shouldFail) throw Exception('Network error');
    return overview ?? const StagiaireOverview(
      tasks: OverviewTaskStats(total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: []),
      upcomingMeetings: [],
    );
  }
}

GoRouter buildRouter() {
  return GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(path: RoutePaths.home, builder: (_, __) => const HomeScreen()),
      GoRoute(path: RoutePaths.mesTaches, builder: (_, __) => const Scaffold(body: Center(child: Text('Tasks')))),
      GoRoute(path: RoutePaths.calendrier, builder: (_, __) => const Scaffold(body: Center(child: Text('Calendar')))),
      GoRoute(path: RoutePaths.journal, builder: (_, __) => const Scaffold(body: Center(child: Text('Journal')))),
      GoRoute(path: RoutePaths.mesNotifications, builder: (_, __) => const Scaffold(body: Center(child: Text('Notifications')))),
      GoRoute(path: RoutePaths.mesCandidatures, builder: (_, __) => const Scaffold(body: Center(child: Text('Applications')))),
    ],
  );
}

ProviderScope buildTestApp({required FakeStagiaireOverviewRepository overviewRepo}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(session: const AuthSession(accessToken: 'token', user: stagiaire)),
      ),
      dashboardRepositoryProvider.overrideWithValue(FakeDashboardRepository()),
      stagiaireOverviewRepositoryProvider.overrideWithValue(overviewRepo),
      pointageRepositoryProvider.overrideWithValue(FakePointageRepository()),
    ],
    child: MaterialApp.router(routerConfig: buildRouter()),
  );
}

StagiaireOverview buildFullOverview() {
  return StagiaireOverview.fromJson({
    'trainee': {'id': 's-1', 'nom': 'Ben Ahmed', 'prenom': 'Sami', 'email': 'sami@steg.tn'},
    'internship': {
      'id': 'stg-1',
      'title': 'Développeur Angular',
      'start_date': '2026-01-15',
      'end_date': '2026-07-15',
      'status': 'EN_COURS',
      'supervisor': {'id': 'e-1', 'full_name': 'Ahmed Ben Salah'},
    },
    'project': {'id': 'p-1', 'titre': 'Dashboard STAG', 'description': 'Application web Angular', 'avancement': 65},
    'tasks': {
      'total': 5, 'todo': 2, 'in_progress': 1, 'completed': 2, 'overdue': 1,
      'next': [
        {'id': 't1', 'titre': 'Finaliser les tests', 'priorite': 'HAUTE', 'date_fin': '2026-08-01', 'statut': 'A_FAIRE'},
      ],
    },
    'upcoming_meetings': [
      {'id': 'r1', 'date': '2026-07-22', 'heure': '10:00', 'sujet': 'Point avancement', 'salle': 'B204', 'lien_visio': null},
      {'id': 'r2', 'date': '2026-07-25', 'heure': '14:30', 'sujet': 'Réunion client', 'salle': 'A101', 'lien_visio': null},
    ],
    'journal': {'total': 4, 'submitted': 3, 'pending': 1},
    'evaluation': {'id': 'ev-1', 'note_finale': 16.4, 'validee': true},
  });
}

void main() {
  group('Loading state', () {
    testWidgets('shows skeleton while loading', (tester) async {
      final repo = FakeStagiaireOverviewRepository();
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pump();
      expect(find.byType(SkeletonCard), findsWidgets);
    });
  });

  group('Error state', () {
    testWidgets('shows error message and retry button', (tester) async {
      final repo = FakeStagiaireOverviewRepository(shouldFail: true);
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Impossible de charger vos données'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });

    testWidgets('retry button is tappable', (tester) async {
      final repo = FakeStagiaireOverviewRepository(shouldFail: true);
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Réessayer'), findsOneWidget);
      expect(find.byIcon(Icons.refresh), findsOneWidget);
    });
  });

  group('Empty state', () {
    testWidgets('shows empty state when no stage', (tester) async {
      final repo = FakeStagiaireOverviewRepository(
        overview: const StagiaireOverview(
          tasks: OverviewTaskStats(total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: []),
          upcomingMeetings: [],
        ),
      );
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Aucun stage actif'), findsOneWidget);
      expect(find.text('Mes candidatures'), findsOneWidget);
    });
  });

  group('Populated state', () {
    testWidgets('shows welcome with trainee name', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.textContaining('Bonjour, Sami'), findsOneWidget);
    });

    testWidgets('shows internship card', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Mon stage'), findsOneWidget);
      expect(find.text('Développeur Angular'), findsOneWidget);
      expect(find.text('Ahmed Ben Salah'), findsOneWidget);
    });

    testWidgets('shows project card', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Mon projet'), findsOneWidget);
      expect(find.text('Dashboard STAG'), findsOneWidget);
    });

    testWidgets('shows tasks section with stats', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Mes tâches'), findsOneWidget);
      expect(find.text('À faire'), findsOneWidget);
      expect(find.text('Terminées'), findsOneWidget);
      expect(find.textContaining('tâche en retard'), findsOneWidget);
    });

    testWidgets('shows meetings section', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Prochaines réunions'), findsOneWidget);
      expect(find.text('Point avancement'), findsOneWidget);
    });

    testWidgets('shows journal section', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Journal hebdomadaire'), findsOneWidget);
      expect(find.text('Soumis'), findsOneWidget);
      expect(find.text('Brouillons'), findsOneWidget);
    });

    testWidgets('shows evaluation section with grade', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Évaluation'), findsOneWidget);
      expect(find.text('16.4'), findsOneWidget);
    });

    testWidgets('hides optional sections when absent', (tester) async {
      final overview = StagiaireOverview.fromJson({
        'trainee': {'id': 's-1', 'nom': 'Ben Ahmed', 'prenom': 'Sami', 'email': 'sami@steg.tn'},
        'internship': {
          'id': 'stg-1', 'title': 'Dev', 'start_date': '2026-01-15', 'status': 'EN_COURS',
          'supervisor': {'id': 'e-1', 'full_name': 'Encadrant'},
        },
        'tasks': {'total': 0, 'todo': 0, 'in_progress': 0, 'completed': 0, 'overdue': 0, 'next': []},
        'upcoming_meetings': [],
      });
      final repo = FakeStagiaireOverviewRepository(overview: overview);
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      expect(find.text('Mon projet'), findsNothing);
      expect(find.text('Prochaines réunions'), findsNothing);
      expect(find.text('Journal hebdomadaire'), findsNothing);
      expect(find.text('Évaluation'), findsNothing);
    });
  });

  group('Navigation', () {
    testWidgets('tasks button navigates to tasks', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      final btn = find.text('Voir toutes les tâches');
      await tester.scrollUntilVisible(btn, 200, scrollable: find.byType(Scrollable).last);
      await tester.tap(btn, warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Tasks'), findsOneWidget);
    });

    testWidgets('calendar button navigates to calendar', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      final btn = find.text('Voir le calendrier');
      await tester.scrollUntilVisible(btn, 200, scrollable: find.byType(Scrollable).last);
      await tester.tap(btn, warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Calendar'), findsOneWidget);
    });

    testWidgets('journal button navigates to journal', (tester) async {
      final repo = FakeStagiaireOverviewRepository(overview: buildFullOverview());
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      final btn = find.text('Voir le journal');
      await tester.scrollUntilVisible(btn, 200, scrollable: find.byType(Scrollable).last);
      await tester.tap(btn, warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Journal'), findsOneWidget);
    });

    testWidgets('empty state candidatures button navigates', (tester) async {
      final repo = FakeStagiaireOverviewRepository(
        overview: const StagiaireOverview(
          tasks: OverviewTaskStats(total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: []),
          upcomingMeetings: [],
        ),
      );
      await tester.pumpWidget(buildTestApp(overviewRepo: repo));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Mes candidatures'), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Applications'), findsOneWidget);
    });
  });
}
