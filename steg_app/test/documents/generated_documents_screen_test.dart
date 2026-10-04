import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
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
import 'package:steg_app/screens/dashboard/my_documents_screen.dart';
import 'package:steg_app/services/document_service.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Trabelsi',
  prenom: 'Fatma',
  email: 'fatma@steg.tn',
  role: 'STAGIAIRE',
);

DashboardStats statsWithStage({String? dateDebut}) {
  return DashboardStats.fromJson({
    'recentStages': [
      {
        'id': 'stage-1',
        'statut': 'EN_COURS',
        'date_debut': dateDebut ?? '2026-09-01T00:00:00.000',
      },
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
  FakeDashboardRepository({
    DashboardStats? stats,
    this.documents = const [],
  }) : stats = stats ?? statsWithStage();

  DashboardStats stats;
  List<DocumentItem> documents;
  int downloadStagePdfCalls = 0;
  String? lastDownloadKind;

  @override
  Future<DashboardStats> getDashboardStats() async => stats;

  @override
  Future<List<Tache>> listTaches() async => const [];

  @override
  Future<List<Reunion>> listReunions() async => const [];

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
  }) async {
    downloadStagePdfCalls++;
    lastDownloadKind = kind;
    return Uint8List(0);
  }

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

Widget buildApp({
  required FakeDashboardRepository repository,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(
            session: AuthSession(accessToken: 'token', user: stagiaire)),
      ),
      dashboardRepositoryProvider.overrideWithValue(repository),
    ],
    child: const MaterialApp(home: MyDocumentsScreen()),
  );
}

void main() {
  testWidgets('renders the three generated documents with type and date',
      (tester) async {
    final repository = FakeDashboardRepository();
    await tester.pumpWidget(buildApp(repository: repository));
    await tester.pumpAndSettle();

    expect(find.text('Documents officiels'), findsOneWidget);
    expect(find.text('Convention de stage'), findsOneWidget);
    expect(find.text('Attestation de stage'), findsOneWidget);
    expect(find.text("Fiche d'évaluation"), findsOneWidget);
    expect(find.textContaining('Convention · 01/09/2026'), findsOneWidget);
    expect(find.textContaining('Attestation · 01/09/2026'), findsOneWidget);
  });

  testWidgets('exposes download and preview actions on generated documents',
      (tester) async {
    final repository = FakeDashboardRepository();
    await tester.pumpWidget(buildApp(repository: repository));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Télécharger'), findsNWidgets(3));
    expect(find.byTooltip('Aperçu'), findsNWidgets(3));
  });

  test('download use case fetches the stage PDF with the expected kind',
      () async {
    final repository = FakeDashboardRepository();
    final container = ProviderContainer(
      overrides: [
        dashboardRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    final bytes = await container
        .read(downloadStagePdfUseCaseProvider)
        .call(stageId: 'stage-1', kind: 'convention');

    expect(bytes, isNotNull);
    expect(repository.downloadStagePdfCalls, 1);
    expect(repository.lastDownloadKind, 'convention');
  });

  testWidgets('hides the generated section without an active internship',
      (tester) async {
    final repository = FakeDashboardRepository(
      stats: DashboardStats.fromJson({}),
    );
    await tester.pumpWidget(buildApp(repository: repository));
    await tester.pumpAndSettle();

    expect(find.text('Documents officiels'), findsNothing);
    expect(find.text('Convention de stage'), findsNothing);
  });

  testWidgets('service builds generated items consumed by the screen',
      (tester) async {
    final service = DocumentService(Dio());
    final items = service.generatedDocumentsForStage(
      stageId: 'stage-1',
      generatedAt: DateTime(2026, 9, 1),
    );

    expect(items.map((item) => item.nom), contains('convention_stage.pdf'));

    final repository = FakeDashboardRepository();
    await tester.pumpWidget(buildApp(repository: repository));
    await tester.pumpAndSettle();

    expect(find.text('Documents officiels'), findsOneWidget);
  });
}
