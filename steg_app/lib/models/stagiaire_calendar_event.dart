import '../core/utils/date_utils.dart';

enum StagiaireCalendarEventType {
  meeting(value: 'MEETING'),
  task(value: 'TASK'),
  internship(value: 'INTERNSHIP');

  const StagiaireCalendarEventType({required this.value});

  final String value;

  static StagiaireCalendarEventType? fromValue(String? value) {
    for (final type in values) {
      if (type.value == value) return type;
    }
    return null;
  }
}

class StagiaireCalendarEvent {
  const StagiaireCalendarEvent({
    required this.id,
    required this.type,
    required this.title,
    this.date,
    this.time,
    this.status,
    this.resourceId,
  });

  factory StagiaireCalendarEvent.fromJson(Map<String, dynamic> json) {
    return StagiaireCalendarEvent(
      id: json['id']?.toString() ?? '',
      type: StagiaireCalendarEventType.fromValue(json['type'] as String?) ??
          StagiaireCalendarEventType.meeting,
      title: json['title'] as String? ?? '',
      date: parseDate(json['date']),
      time: json['time'] as String?,
      status: json['status'] as String?,
      resourceId: json['resource_id']?.toString(),
    );
  }

  final String id;
  final StagiaireCalendarEventType type;
  final String title;
  final DateTime? date;
  final String? time;
  final String? status;
  final String? resourceId;
}
