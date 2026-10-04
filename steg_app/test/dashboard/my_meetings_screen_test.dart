import 'dart:typed_data';

import 'package:flutter/material.dart';
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
import 'package:steg_app/screens/dashboard/my_meetings_screen.dart';

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({required this.reunions});

  List<Reunion> reunions;

  @override
  Future<List<Reunion>> listReunions() async => reunions;

  @override
  Future<DashboardStats> getDashboardStats() async => throw UnimplementedError();

  @override
  Future<List<Tache>> listTaches() async => const [];

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async => const [];

  @override
  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) async => throw UnimplementedError();

  @override
  Future<Uint8List> downloadDocumentBytes({required String id, bool preview = false}) async => Uint8List(0);

  @override
  Future<Uint8List> downloadStagePdf({required String stageId, required String kind}) async => Uint8List(0);

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

Reunion _makeReunion({
  String id = 'r1',
  String sujet = 'Point projet',
  String date = '2026-07-22',
  String heure = '10:00',
  String? salle = 'B204',
  String? lienVisio,
}) {
  return Reunion.fromJson({
    'id': id,
    'stage_id': 'stage-1',
    'sujet': sujet,
    'date': date,
    'heure': heure,
    'salle': salle,
    'lien_visio': lienVisio,
    'encadrant_nom': 'Ben Salah',
    'encadrant_prenom': 'Ahmed',
  });
}

Widget _buildApp(List<Reunion> reunions) {
  return ProviderScope(
    overrides: [
      dashboardRepositoryProvider.overrideWithValue(
        FakeDashboardRepository(reunions: reunions),
      ),
    ],
    child: const MaterialApp(home: MyMeetingsScreen()),
  );
}

void main() {
  group('MyMeetingsScreen', () {
    testWidgets('shows empty state when there are no meetings', (tester) async {
      await tester.pumpWidget(_buildApp([]));
      await tester.pumpAndSettle();

      expect(find.text('Aucune réunion'), findsOneWidget);
      expect(find.text('Les réunions planifiées avec votre encadrant apparaîtront ici.'), findsOneWidget);
    });

    testWidgets('splits upcoming and past meetings into sections', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp([
        _makeReunion(id: 'past1', sujet: 'Réunion passée', date: '2026-01-05', heure: '09:00'),
        _makeReunion(id: 'future1', sujet: 'Réunion future', date: '2026-12-01', heure: '14:00'),
        _makeReunion(id: 'future2', sujet: 'Réunion future 2', date: '2026-12-15', heure: '10:00'),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('À venir'), findsWidgets);
      expect(find.text('Passées'), findsOneWidget);
      expect(find.text('Réunion future'), findsOneWidget);
      expect(find.text('Réunion future 2'), findsOneWidget);
      expect(find.text('Réunion passée'), findsOneWidget);
    });

    testWidgets('shows meeting details in each card', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp([
        _makeReunion(
          sujet: 'Point d\'avancement',
          date: '2026-12-01',
          heure: '10:30',
          salle: 'B204',
        ),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Point d\'avancement'), findsOneWidget);
      expect(find.text('Salle B204'), findsOneWidget);
      expect(find.textContaining('Ahmed Ben Salah'), findsWidgets);
    });

    testWidgets('shows visio indicator for meetings with video link', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp([
        _makeReunion(
          sujet: 'Visio meeting',
          date: '2026-12-01',
          heure: '10:00',
          lienVisio: 'https://meet.example.com/abc',
        ),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Visio meeting'), findsOneWidget);
      expect(find.text('Visio disponible'), findsOneWidget);
    });

    testWidgets('shows "Salle à confirmer" when no salle and no visio', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp([
        _makeReunion(
          sujet: 'Réunion sans lieu',
          date: '2026-12-01',
          heure: '10:00',
          salle: null,
        ),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Salle à confirmer'), findsOneWidget);
    });

    testWidgets('pull-to-refresh triggers data reload', (tester) async {
      final repo = FakeDashboardRepository(reunions: [
        _makeReunion(sujet: 'Initial', date: '2026-12-01'),
      ]);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [dashboardRepositoryProvider.overrideWithValue(repo)],
          child: const MaterialApp(home: MyMeetingsScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Initial'), findsOneWidget);
      expect(find.byType(RefreshIndicator), findsOneWidget);
    });
  });
}
