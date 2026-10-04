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

DashboardStats statsWithInternship() {
  return DashboardStats.fromJson({
    'recentStages': [
      {
        'id': 'stage-1',
        'statut': 'EN_COURS',
      },
    ],
  });
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({
    DashboardStats? stats,
    this.documents = const [],
  }) : stats = stats ?? DashboardStats.fromJson({});

  DashboardStats stats;
  List<DocumentItem> documents;

  int uploadCalls = 0;
  int deleteCalls = 0;

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

  group('myDocumentsProvider', () {
    test('upload delegates to the repository and prepends the document', () async {
      final repository = FakeDashboardRepository(
        stats: statsWithInternship(),
        documents: [DocumentItem.fromJson({'id': 'd-1', 'type': 'CV'})],
      );
      final container = containerWith(repository);

      await container.read(myDocumentsProvider.future);
      final created = await container
          .read(myDocumentsProvider.notifier)
          .upload(type: 'RAPPORT', filePath: '/tmp/rapport.pdf', fileName: 'rapport.pdf');

      expect(repository.uploadCalls, 1);
      expect(created.type, 'RAPPORT');
      final documents = container.read(myDocumentsProvider).requireValue;
      expect(documents.map((d) => d.id), ['uploaded-1', 'd-1']);
    });

    test('upload throws without an active internship', () async {
      final repository = FakeDashboardRepository(stats: DashboardStats.fromJson({}));
      final container = containerWith(repository);

      await expectLater(
        container.read(myDocumentsProvider.notifier).upload(
              type: 'RAPPORT',
              filePath: '/tmp/rapport.pdf',
            ),
        throwsStateError,
      );
      expect(repository.uploadCalls, 0);
    });

    test('delete removes the document locally and notifies the repository', () async {
      final repository = FakeDashboardRepository(
        stats: statsWithInternship(),
        documents: [
          DocumentItem.fromJson({'id': 'd-1', 'type': 'CV'}),
          DocumentItem.fromJson({'id': 'd-2', 'type': 'ASSURANCE'}),
        ],
      );
      final container = containerWith(repository);

      await container.read(myDocumentsProvider.future);
      await container.read(myDocumentsProvider.notifier).delete('d-1');

      expect(repository.deleteCalls, 1);
      final documents = container.read(myDocumentsProvider).requireValue;
      expect(documents.map((d) => d.id), ['d-2']);
    });
  });
}
