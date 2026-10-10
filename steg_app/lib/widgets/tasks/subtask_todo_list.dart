import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/subtask.dart';
import 'todo_status_control.dart';

/// Clean Todo list used inside the task details screen.
///
/// Rows are separated by hairline dividers (no card per subtask): a status
/// control on the left, the subtask title (muted + struck through once done)
/// and a chevron on the right. Tapping the control opens the status
/// selector, tapping the row opens the subtask details.
class SubtaskTodoList extends StatelessWidget {
  const SubtaskTodoList({
    super.key,
    required this.subtasks,
    required this.updatingIds,
    required this.onStatusControlTap,
    required this.onRowTap,
  });

  final List<Subtask> subtasks;
  final Set<String> updatingIds;
  final ValueChanged<Subtask> onStatusControlTap;
  final ValueChanged<Subtask> onRowTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radius),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < subtasks.length; i++) ...[
            if (i > 0) const Divider(height: 1, thickness: 1),
            _SubtaskTodoRow(
              subtask: subtasks[i],
              updating: updatingIds.contains(subtasks[i].id),
              onStatusControlTap: () => onStatusControlTap(subtasks[i]),
              onRowTap: () => onRowTap(subtasks[i]),
            ),
          ],
        ],
      ),
    );
  }
}

class _SubtaskTodoRow extends StatelessWidget {
  const _SubtaskTodoRow({
    required this.subtask,
    required this.updating,
    required this.onStatusControlTap,
    required this.onRowTap,
  });

  final Subtask subtask;
  final bool updating;
  final VoidCallback onStatusControlTap;
  final VoidCallback onRowTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final done = subtask.status == SubtaskStatus.done;
    final description = subtask.description?.trim() ?? '';

    return InkWell(
      onTap: onRowTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            TodoStatusControl(
              key: ValueKey('status-control-${subtask.id}'),
              status: subtask.status,
              loading: updating,
              onTap: updating ? null : onStatusControlTap,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subtask.titre,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      decoration: done ? TextDecoration.lineThrough : null,
                      decorationColor: AppColors.textTertiary,
                      color: done
                          ? AppColors.textTertiary
                          : AppColors.textPrimary,
                    ),
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                        decoration: done ? TextDecoration.lineThrough : null,
                        decorationColor: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
