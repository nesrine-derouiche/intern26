import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/subtask.dart';
import '../../models/tache.dart';
import '../common/animated_progress.dart';

/// Aggregate progress + deadline block shared by the parent task card and
/// the task details header.
///
/// * `aggregate == null` → subtasks are still loading: only the deadline is
///   rendered (no percent, never `NaN %` / `Infinity %`).
/// * empty aggregate → `Aucune sous-tâche`, no percent and no bar.
/// * every subtask done → `✓ Tâche terminée` with a 100 % success bar.
class ParentTaskSummary extends StatelessWidget {
  const ParentTaskSummary({
    super.key,
    required this.task,
    required this.aggregate,
  });

  final Tache task;

  /// Backend-authoritative aggregate, or `null` while loading.
  final SubtaskAggregate? aggregate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final current = aggregate;
    final completed = current != null && !current.isEmpty && current.isComplete;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (current != null) ...[
          Row(
            children: [
              if (completed) ...[
                const Icon(
                  Icons.check_rounded,
                  size: 15,
                  color: AppColors.success,
                ),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  current.isEmpty
                      ? 'Aucune sous-tâche'
                      : completed
                          ? 'Tâche terminée'
                          : current.total == 1
                              ? '1 sous-tâche'
                              : '${current.total} sous-tâches',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: completed ? AppColors.success : AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (!current.isEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  current.progressLabel,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: completed ? AppColors.success : AppColors.textPrimary,
                  ),
                ),
              ],
            ],
          ),
          if (!current.isEmpty) ...[
            const SizedBox(height: 8),
            AnimatedLinearProgress(
              value: (current.progress ?? 0) / 100,
              minHeight: 6,
              color: completed ? AppColors.success : null,
            ),
          ],
          const SizedBox(height: 10),
        ],
        Row(
          children: [
            const Icon(
              Icons.calendar_today_outlined,
              size: 14,
              color: AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                task.echeanceLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
