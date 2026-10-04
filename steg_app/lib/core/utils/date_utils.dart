DateTime? parseDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}

DateTime dateOnly(DateTime date) {
  return DateTime(date.year, date.month, date.day);
}

DateTime startOfWeek(DateTime date) {
  return DateTime(date.year, date.month, date.day - (date.weekday - 1));
}

String formatDateFr(DateTime? date) {
  if (date == null) return '—';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(date.day)}/${two(date.month)}/${date.year}';
}

String formatTimeFr(String? time) {
  if (time == null || time.isEmpty) return '—';
  final parts = time.split(':');
  if (parts.length < 2) return time;
  final hour = int.tryParse(parts[0]) ?? 0;
  final minute = int.tryParse(parts[1]) ?? 0;
  return '${hour.toString().padLeft(2, '0')}h${minute.toString().padLeft(2, '0')}';
}

String formatRelativeDayFr(DateTime? date) {
  if (date == null) return '—';
  final today = dateOnly(DateTime.now());
  final target = dateOnly(date);
  final diff = target.difference(today).inDays;
  return switch (diff) {
    0 => "Aujourd'hui",
    1 => 'Demain',
    _ when diff > 1 => 'Dans $diff jours',
    _ when diff < 0 => 'Il y a ${-diff} jour${-diff > 1 ? 's' : ''}',
    _ => formatDateFr(date),
  };
}
