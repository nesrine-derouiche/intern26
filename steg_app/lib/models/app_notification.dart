import '../core/utils/date_utils.dart';
import 'notification_category.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.titre,
    required this.message,
    required this.date,
    required this.type,
    required this.lue,
    this.utilisateurId = '',
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id']?.toString() ?? '',
      utilisateurId: json['utilisateur_id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      message: json['message'] as String? ?? '',
      date: parseDate(json['date']),
      type: json['type'] as String? ?? 'INFO',
      lue: json['lue'] as bool? ?? false,
    );
  }

  final String id;
  final String utilisateurId;
  final String titre;
  final String message;
  final DateTime? date;
  final String type;
  final bool lue;

  NotificationCategory get category => NotificationCategory.fromValue(type);

  AppNotification copyWith({bool? lue}) {
    return AppNotification(
      id: id,
      utilisateurId: utilisateurId,
      titre: titre,
      message: message,
      date: date,
      type: type,
      lue: lue ?? this.lue,
    );
  }
}
