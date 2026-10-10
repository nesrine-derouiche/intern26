import '../core/utils/date_utils.dart';

class Note {
  const Note({
    required this.id,
    required this.titre,
    required this.contenu,
    required this.pinned,
    this.clientKey,
    this.createdAt,
    this.updatedAt,
  });

  factory Note.fromJson(Map<String, dynamic> json) {
    return Note(
      id: json['id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      contenu: json['contenu'] as String? ?? '',
      pinned: json['pinned'] == true,
      clientKey: json['client_key'] as String?,
      createdAt: parseDate(json['created_at']),
      updatedAt: parseDate(json['updated_at']),
    );
  }

  final String id;
  final String titre;
  final String contenu;
  final bool pinned;
  final String? clientKey;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get displayTitle {
    if (titre.trim().isNotEmpty) return titre.trim();
    for (final line in contenu.split('\n')) {
      if (line.trim().isNotEmpty) return line.trim();
    }
    return 'Sans titre';
  }

  String get snippet {
    final lines = contenu
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    if (titre.trim().isNotEmpty) {
      return lines.join(' ');
    }
    if (lines.length <= 1) return '';
    return lines.skip(1).join(' ');
  }

  String get updatedLabel {
    if (updatedAt == null) return '—';
    return formatRelativeDayFr(updatedAt);
  }

  Note copyWith({
    String? titre,
    String? contenu,
    bool? pinned,
    DateTime? updatedAt,
  }) {
    return Note(
      id: id,
      titre: titre ?? this.titre,
      contenu: contenu ?? this.contenu,
      pinned: pinned ?? this.pinned,
      clientKey: clientKey,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
