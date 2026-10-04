import 'dart:typed_data';

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

const stagiaire = User(
  id: 's-1',
  nom: 'Trabelsi',
  prenom: 'Fatma',
  email: 'fatma@steg.tn',
  role: 'STAGIAIRE',
);

const encadrant = User(
  id: 'e-1',
  nom: 'Ben Salah',
  prenom: 'Ahmed',
  email: 'ahmed@steg.tn',
  role: 'ENCADRANT',
);

DashboardStats buildStats() {
  return DashboardStats.fromJson({
    'recentStages': [
      {
        'id': 'stage-1',
        'statut': 'EN_COURS',
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
  }) : stats = stats ?? buildStats();

  DashboardStats stats;
  List<DocumentItem> documents;

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
    final document = DocumentItem.fromJson({
      'id': 'uploaded-1',
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
    documents = documents.where((d) => d.id != id).toList();
  }

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
  required User user,
  List<DocumentItem> documents = const [],
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(session: AuthSession(accessToken: 'token', user: user)),
      ),
      dashboardRepositoryProvider.overrideWithValue(
        FakeDashboardRepository(documents: documents),
      ),
    ],
    child: const MaterialApp(home: MyDocumentsScreen()),
  );
}

void main() {
  testWidgets('renders official documents and deposited documents for a stagiaire',
      (tester) async {
    await tester.pumpWidget(
      buildApp(
        user: stagiaire,
        documents: [
          DocumentItem.fromJson({
            'id': 'd-1',
            'stage_id': 'stage-1',
            'type': 'RAPPORT',
            'nom': 'rapport_stage.pdf',
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Documents officiels'), findsOneWidget);
    expect(find.text('Convention de stage'), findsOneWidget);
    expect(find.text('Attestation de stage'), findsOneWidget);
    expect(find.text('Fiche d\'évaluation'), findsOneWidget);

    expect(find.text('Documents déposés'), findsOneWidget);
    expect(find.text('rapport_stage.pdf'), findsOneWidget);
    expect(find.text('Déposer un document'), findsOneWidget);
  });

  testWidgets('opens the upload type sheet from the floating action button',
      (tester) async {
    await tester.pumpWidget(buildApp(user: stagiaire));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Déposer un document'));
    await tester.pumpAndSettle();

    for (final label in ['CV', 'Convention', 'Assurance', 'Rapport', 'Attestation']) {
      expect(find.text(label), findsWidgets);
    }
  });

  testWidgets('does not expose the delete action to a stagiaire', (tester) async {
    await tester.pumpWidget(
      buildApp(
        user: stagiaire,
        documents: [
          DocumentItem.fromJson({
            'id': 'd-1',
            'stage_id': 'stage-1',
            'type': 'CV',
            'nom': 'cv.pdf',
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(PopupMenuButton<String>).first);
    await tester.pumpAndSettle();

    expect(find.text('Supprimer'), findsNothing);
  });

  testWidgets('exposes the delete action to an encadrant', (tester) async {
    await tester.pumpWidget(
      buildApp(
        user: encadrant,
        documents: [
          DocumentItem.fromJson({
            'id': 'd-1',
            'stage_id': 'stage-1',
            'type': 'RAPPORT',
            'nom': 'rapport_stage.pdf',
          }),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(PopupMenuButton<String>).first);
    await tester.pumpAndSettle();

    expect(find.text('Supprimer'), findsOneWidget);
  });
}
