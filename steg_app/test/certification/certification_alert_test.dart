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
import 'package:steg_app/models/evaluation.dart';
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
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeDashboardRepository implements DashboardRepository {
  @override
  Future<DashboardStats> getDashboardStats() async =>
      DashboardStats.fromJson({});

  @override
  Future<List<Tache>> listTaches() async => const [];

  @override
  Future<List<Reunion>> listReunions() async => const [];

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async =>
      const [];

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
  }) async => Uint8List(0);

  @override
  Future<Uint8List> downloadStagePdf({
    required String stageId,
    required String kind,
  }) async => Uint8List(0);

  @override
  Future<void> deleteDocument(String id) async {}

  @override
  Future<List<Evaluation>> listEvaluations() async => const [];

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

class FakeOverviewRepository implements StagiaireOverviewRepository {
  FakeOverviewRepository(this.overview);

  final StagiaireOverview overview;

  @override
  Future<StagiaireOverview> getOverview() async => overview;
}

StagiaireOverview overviewWithEndDate(DateTime? endDate) {
  return StagiaireOverview.fromJson({
    'trainee': {
      'id': 's-1',
      'nom': 'Ben Ahmed',
      'prenom': 'Sami',
      'email': 'sami@steg.tn',
    },
    'internship': {
      'id': 'stg-1',
      'title': 'Stage',
      'start_date': '2026-01-15',
      'end_date': endDate == null
          ? null
          : '${endDate.year.toString().padLeft(4, '0')}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}',
      'status': 'EN_COURS',
    },
    'tasks': {
      'total': 0,
      'todo': 0,
      'in_progress': 0,
      'completed': 0,
      'overdue': 0,
      'next': [],
    },
    'upcoming_meetings': [],
  });
}

Widget buildTestApp(StagiaireOverview overview) {
  final router = GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(path: RoutePaths.home, builder: (context, state) => const HomeScreen()),
      GoRoute(
        path: RoutePaths.certification,
        builder: (context, state) =>
            const Scaffold(body: Center(child: Text('Certification stub'))),
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
      ),
      dashboardRepositoryProvider.overrideWithValue(FakeDashboardRepository()),
      stagiaireOverviewRepositoryProvider.overrideWithValue(
        FakeOverviewRepository(overview),
      ),
      pointageRepositoryProvider.overrideWithValue(FakePointageRepository()),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

void main() {
  testWidgets('shows the alert inside the final seven days', (tester) async {
    final end = DateTime.now().add(const Duration(days: 3));
    await tester.pumpWidget(buildTestApp(overviewWithEndDate(end)));
    await tester.pumpAndSettle();

    expect(find.text('Dernière semaine de stage'), findsOneWidget);
    expect(find.text('Compléter la validation du stage'), findsOneWidget);
  });

  testWidgets('navigates to the validation screen from the alert', (
    tester,
  ) async {
    final end = DateTime.now().add(const Duration(days: 3));
    await tester.pumpWidget(buildTestApp(overviewWithEndDate(end)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Compléter la validation du stage'));
    await tester.pumpAndSettle();

    expect(find.text('Certification stub'), findsOneWidget);
  });

  testWidgets('hides the alert outside the final week', (tester) async {
    final end = DateTime.now().add(const Duration(days: 30));
    await tester.pumpWidget(buildTestApp(overviewWithEndDate(end)));
    await tester.pumpAndSettle();

    expect(find.text('Dernière semaine de stage'), findsNothing);
    expect(find.text('Compléter la validation du stage'), findsNothing);
  });

  testWidgets('hides the alert without an end date', (tester) async {
    await tester.pumpWidget(buildTestApp(overviewWithEndDate(null)));
    await tester.pumpAndSettle();

    expect(find.text('Dernière semaine de stage'), findsNothing);
  });
}
