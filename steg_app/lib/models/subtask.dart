import '../core/utils/date_utils.dart';
import '../core/utils/json_utils.dart';

enum SubtaskStatus {
  todo(value: 'TODO', label: 'À faire', progress: 0),
  inProgress(value: 'IN_PROGRESS', label: 'En cours', progress: 50),
  done(value: 'DONE', label: 'Terminée', progress: 100);

  const SubtaskStatus({
    required this.value,
    required this.label,
    required this.progress,
  });

  final String value;
  final String label;
  final int progress;

  static SubtaskStatus? fromValue(String? value) {
    for (final status in values) {
      if (status.value == value) return status;
    }
    return null;
  }
}

class Subtask {
  const Subtask({
    required this.id,
    required this.tacheId,
    required this.titre,
    this.description,
    required this.statut,
    this.createdAt,
    this.updatedAt,
  });

  factory Subtask.fromJson(Map<String, dynamic> json) {
    return Subtask(
      id: json['id']?.toString() ?? '',
      tacheId: json['tache_id']?.toString() ?? '',
      titre: json['titre'] as String? ?? '',
      description: json['description'] as String?,
      statut: json['statut'] as String? ?? 'TODO',
      createdAt: parseDate(json['created_at']),
      updatedAt: parseDate(json['updated_at']),
    );
  }

  final String id;
  final String tacheId;
  final String titre;
  final String? description;
  final String statut;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  SubtaskStatus get status =>
      SubtaskStatus.fromValue(statut) ?? SubtaskStatus.todo;

  String get statusLabel => status.label;

  int get progressValue => status.progress;

  Subtask copyWith({String? statut}) {
    return Subtask(
      id: id,
      tacheId: tacheId,
      titre: titre,
      description: description,
      statut: statut ?? this.statut,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}

class SubtaskAggregate {
  const SubtaskAggregate({
    required this.total,
    required this.todo,
    required this.inProgress,
    required this.done,
    required this.progress,
  });

  factory SubtaskAggregate.fromSubtasks(List<Subtask> subtasks) {
    var todo = 0;
    var inProgress = 0;
    var done = 0;
    var sum = 0;
    for (final subtask in subtasks) {
      switch (subtask.status) {
        case SubtaskStatus.todo:
          todo++;
          break;
        case SubtaskStatus.inProgress:
          inProgress++;
          break;
        case SubtaskStatus.done:
          done++;
          break;
      }
      sum += subtask.progressValue;
    }
    final total = subtasks.length;
    return SubtaskAggregate(
      total: total,
      todo: todo,
      inProgress: inProgress,
      done: done,
      progress: total == 0 ? null : (sum / total).round(),
    );
  }

  factory SubtaskAggregate.fromJson(Map<String, dynamic> json) {
    return SubtaskAggregate(
      total: numOrNull(json['total'])?.toInt() ?? 0,
      todo: numOrNull(json['todo'])?.toInt() ?? 0,
      inProgress: numOrNull(json['in_progress'])?.toInt() ?? 0,
      done: numOrNull(json['done'])?.toInt() ?? 0,
      progress: numOrNull(json['progress'])?.toInt(),
    );
  }

  final int total;
  final int todo;
  final int inProgress;
  final int done;
  final int? progress;

  bool get isEmpty => total == 0;

  bool get isComplete => total > 0 && done == total;

  String get progressLabel => progress == null ? '—' : '$progress %';
}

/// Payload returned by `GET /taches/:id/subtasks`.
///
/// [aggregate] carries the authoritative progress computed by the backend.
/// When the payload omits it (or its totals do not match the returned rows),
/// the client falls back to the same arithmetic on the returned rows so the
/// UI can never render `NaN %` / `Infinity %`.
class SubtaskListResult {
  const SubtaskListResult({required this.subtasks, required this.aggregate});

  factory SubtaskListResult.fromPayload({
    required List<Subtask> subtasks,
    Object? aggregate,
  }) {
    if (aggregate is Map<String, dynamic> && aggregate['total'] != null) {
      final parsed = SubtaskAggregate.fromJson(aggregate);
      if (parsed.total == subtasks.length) {
        return SubtaskListResult(subtasks: subtasks, aggregate: parsed);
      }
    }
    return SubtaskListResult(
      subtasks: subtasks,
      aggregate: SubtaskAggregate.fromSubtasks(subtasks),
    );
  }

  final List<Subtask> subtasks;
  final SubtaskAggregate aggregate;
}
