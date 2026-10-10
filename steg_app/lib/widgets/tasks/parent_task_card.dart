import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/tache.dart';
import '../../providers/tasks/task_subtasks_provider.dart';
import 'parent_task_summary.dart';

/// Parent task card of the task list.
///
/// The parent task is never a plain checkbox: it is the container of the
/// subtask Todo list and shows title, description, subtask count, aggregate
/// progress and deadline. Progress comes from the backend aggregate.
class ParentTaskCard extends ConsumerWidget {
  const ParentTaskCard({
    super.key,
    required this.task,
    required this.onTap,
  });

  final Tache task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final subtasksAsync = ref.watch(taskSubtasksProvider(task.id));
    final result = subtasksAsync.asData?.value;
    final aggregate = result?.aggregate;
    final completed =
        aggregate != null && !aggregate.isEmpty && aggregate.isComplete;

    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radius),
        side: BorderSide(
          color: completed
              ? AppColors.success.withValues(alpha: 0.45)
              : AppColors.border,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      task.titre,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: completed
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.textTertiary,
                  ),
                ],
              ),
              if (task.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  task.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              ParentTaskSummary(task: task, aggregate: aggregate),
            ],
          ),
        ),
      ),
    );
  }
}
