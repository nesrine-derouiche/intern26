import 'dart:typed_data';

import '../../../models/app_notification.dart';
import '../../../models/dashboard_stats.dart';
import '../../../models/document_item.dart';
import '../../../models/evaluation.dart';
import '../../../models/paginated_result.dart';
import '../../../models/reunion.dart';
import '../../../models/supervisor_info.dart';
import '../../../models/tache.dart';
import '../../../services/dashboard_service.dart';
import '../../../services/document_service.dart';
import '../../../services/encadrant_service.dart';
import '../../../services/evaluation_service.dart';
import '../../../services/notification_service.dart';
import '../../../services/reunion_service.dart';
import '../../../services/tache_service.dart';
import '../domain/dashboard_repository.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl({
    required DashboardService dashboardService,
    required TacheService tacheService,
    required ReunionService reunionService,
    required DocumentService documentService,
    required NotificationService notificationService,
    required EncadrantService encadrantService,
    required EvaluationService evaluationService,
  })  : _dashboardService = dashboardService,
        _tacheService = tacheService,
        _reunionService = reunionService,
        _documentService = documentService,
        _notificationService = notificationService,
        _encadrantService = encadrantService,
        _evaluationService = evaluationService;

  static const int _pageSize = 100;

  final DashboardService _dashboardService;
  final TacheService _tacheService;
  final ReunionService _reunionService;
  final DocumentService _documentService;
  final NotificationService _notificationService;
  final EncadrantService _encadrantService;
  final EvaluationService _evaluationService;

  @override
  Future<DashboardStats> getDashboardStats() {
    return _dashboardService.getStats();
  }

  @override
  Future<List<Tache>> listTaches() async {
    return _fetchAll((page) => _tacheService.list(page: page, limit: _pageSize));
  }

  @override
  Future<List<Reunion>> listReunions() async {
    return _fetchAll((page) => _reunionService.list(page: page, limit: _pageSize));
  }

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async {
    return _fetchAll(
      (page) => _documentService.listByStage(stageId: stageId, page: page, limit: _pageSize),
    );
  }

  @override
  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) {
    return _documentService.upload(
      stageId: stageId,
      type: type,
      filePath: filePath,
      fileName: fileName,
    );
  }

  @override
  Future<Uint8List> downloadDocumentBytes({required String id, bool preview = false}) {
    return _documentService.downloadBytes(id, preview: preview);
  }

  @override
  Future<Uint8List> downloadStagePdf({required String stageId, required String kind}) {
    return _documentService.downloadStagePdf(stageId: stageId, kind: kind);
  }

  @override
  Future<void> deleteDocument(String id) {
    return _documentService.delete(id);
  }

  @override
  Future<List<Evaluation>> listEvaluations() async {
    return _fetchAll((page) => _evaluationService.list(page: page, limit: _pageSize));
  }

  @override
  Future<List<AppNotification>> listNotifications() async {
    return _fetchAll((page) => _notificationService.list(page: page, limit: _pageSize));
  }

  @override
  Future<int> unreadNotificationsCount() {
    return _notificationService.unreadCount();
  }

  @override
  Future<List<SupervisorInfo>> listSupervisors() async {
    return _encadrantService.list();
  }

  @override
  Future<void> markNotificationAsRead(String id) {
    return _notificationService.markAsRead(id);
  }

  @override
  Future<void> markAllNotificationsAsRead() {
    return _notificationService.markAllAsRead();
  }

  @override
  Future<void> deleteNotification(String id) {
    return _notificationService.delete(id);
  }
}

Future<List<T>> _fetchAll<T>(
  Future<PaginatedResult<T>> Function(int page) fetchPage,
) async {
  final first = await fetchPage(1);
  final items = [...first.data];
  for (var page = 2; page <= first.pages; page++) {
    final result = await fetchPage(page);
    items.addAll(result.data);
  }
  return items;
}
