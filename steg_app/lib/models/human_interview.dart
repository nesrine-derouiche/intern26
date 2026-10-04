import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

/// Entretien humain planifié par le RH, lu par le candidat (lecture seule).
///
/// Le lien de réunion (`lienVisio`) provient exclusivement du backend : le
/// client ne génère ni ne modifie jamais le lien.
class HumanInterview {
  const HumanInterview({
    required this.id,
    required this.date,
    required this.heure,
    required this.duree,
    required this.interviewer,
    required this.interviewerEmail,
    required this.lienVisio,
    required this.statut,
  });

  factory HumanInterview.fromJson(Map<String, dynamic> json) {
    return HumanInterview(
      id: json['id']?.toString() ?? '',
      date: parseDate(json['date']),
      heure: json['heure'] as String? ?? '',
      duree: numOrNull(json['duree'])?.toInt(),
      interviewer: json['interviewer'] as String? ?? '',
      interviewerEmail: json['interviewer_email'] as String? ?? '',
      lienVisio: json['lien_visio'] as String? ?? '',
      statut: json['statut'] as String? ?? '',
    );
  }

  final String id;
  final DateTime? date;
  final String heure;
  final int? duree;
  final String interviewer;
  final String interviewerEmail;
  final String lienVisio;
  final String statut;

  static const String statutPlanifie = 'PLANIFIE';
  static const String statutAnnule = 'ANNULE';

  bool get isScheduled => statut == statutPlanifie;
  bool get isCancelled => statut == statutAnnule;

  /// Date au format DD/MM/YYYY.
  String get dateLabel => formatDateFr(date);

  /// Heure au format HH:mm (fournie normalisée par le backend).
  String get timeLabel => heure.isEmpty ? '—' : heure;

  String get durationLabel => duree == null ? '—' : '$duree minutes';

  bool get hasMeetingLink => lienVisio.trim().isNotEmpty;
}
