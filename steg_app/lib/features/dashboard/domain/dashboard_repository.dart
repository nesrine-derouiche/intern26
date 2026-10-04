import 'dart:typed_data';

import '../../../models/app_notification.dart';
import '../../../models/dashboard_stats.dart';
import '../../../models/document_item.dart';
import '../../../models/evaluation.dart';
import '../../../models/reunion.dart';
import '../../../models/supervisor_info.dart';
import '../../../models/tache.dart';

abstract interface class DashboardRepository {
  Future<DashboardStats> getDashboardStats();

  Future<List<Tache>> listTaches();

  Future<List<Reunion>> listReunions();

  Future<List<DocumentItem>> listDocuments({required String stageId});

  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  });

  Future<Uint8List> downloadDocumentBytes({required String id, bool preview = false});

  Future<Uint8List> downloadStagePdf({required String stageId, required String kind});

  Future<void> deleteDocument(String id);

  Future<List<Evaluation>> listEvaluations();

  Future<List<AppNotification>> listNotifications();

  Future<int> unreadNotificationsCount();

  Future<void> markNotificationAsRead(String id);

  Future<void> markAllNotificationsAsRead();

  Future<void> deleteNotification(String id);

  Future<List<SupervisorInfo>> listSupervisors();
}
