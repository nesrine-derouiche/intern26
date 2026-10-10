import 'dart:io';

class ApiConstants {
  ApiConstants._();

  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_envBaseUrl.isNotEmpty) return _envBaseUrl;
    return Platform.isAndroid
        ? 'http://10.0.2.2:3000/api'
        : 'http://localhost:3000/api';
  }

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const String contentTypeJson = 'application/json';

  static const String login = '/auth/login';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String me = '/auth/me';
  static const String updateProfile = '/auth/profile';
  static const String changePassword = '/auth/change-password';
  static const String offres = '/offres';
  static const String candidatures = '/candidatures';
  static const String myCandidatures = '/candidatures/mes-candidatures';
  static const String dashboardStats = '/dashboard/stats';
  static const String taches = '/taches';

  static String subtasksOfTask(String taskId) => '/taches/$taskId/subtasks';

  static String taskProgress(String taskId) => '/taches/$taskId/progress';

  static String subtaskStatus(String id) => '/subtasks/$id/status';
  static const String reunions = '/reunions';
  static const String notifications = '/notifications';
  static const String notificationsUnread = '/notifications/unread';
  static const String notificationsLireTout = '/notifications/lire-tout';
  static const String encadrants = '/encadrants';
  static const String evaluations = '/evaluations';
  static const String journals = '/journals';

  static const String planning = '/planning';

  static const String pointages = '/pointages';
  static String pointageHoraires(String stageId) => '/pointages/horaires/$stageId';
  static String pointageStats(String stageId) => '/pointages/stats/$stageId';

  static String documentsOfStage(String stageId) => '/stages/$stageId/documents';

  static String documentDownload(String id) => '/documents/$id/download';

  static String documentPreview(String id) => '/documents/$id/preview';

  static String documentDelete(String id) => '/documents/$id';

  static String onboardingDocument(String candidatureId, String type) =>
      '/candidatures/$candidatureId/documents/$type';

  static String internshipAccess(String candidatureId) =>
      '/candidatures/$candidatureId/internship-access';

  static String stagePdf(String stageId, String kind) =>
      '/stages/$stageId/pdf/$kind';

  static String certificationDocumentDownload(String stageId, String docId) =>
      '/stages/$stageId/certification/documents/$docId/download';

  static String notificationLire(String id) => '/notifications/$id/lire';

  static String notificationDelete(String id) => '/notifications/$id';

  static const String notificationDeviceToken = '/notifications/device-token';

  static String stagiaire(String id) => '/stagiaires/$id';

  static const String stagiaireOverview = '/stagiaires/overview';
  static const String stagiaireProject = '/stagiaires/projet';
  static const String stagiaireCalendar = '/stagiaires/calendar';
  static const String stagiaireCompletion = '/stagiaires/completion';

  static const String notes = '/notes';

  static String noteById(String id) => '/notes/$id';

  static String certification(String stageId) =>
      '/stages/$stageId/certification';

  static String certificationDocument(String stageId, String kind) =>
      '/stages/$stageId/certification/documents/$kind';

  static String certificationSubmit(String stageId) =>
      '/stages/$stageId/certification/submit';

  static String certificationAttestation(String stageId) =>
      '/stages/$stageId/certification/attestation';

  static String stageComplete(String stageId) => '/stages/$stageId/complete';
}
