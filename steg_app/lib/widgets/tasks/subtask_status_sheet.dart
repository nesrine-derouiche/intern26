import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/subtask.dart';
import 'todo_status_control.dart';

/// Opens the small status selector used by the Todo list.
///
/// Returns the selected [SubtaskStatus], or `null` when dismissed. The
/// current status of [subtask] is highlighted; no state is applied by the
/// sheet itself — the caller calls the backend API with the selection.
Future<SubtaskStatus?> showSubtaskStatusSheet(
  BuildContext context, {
  required Subtask subtask,
}) {
  return showModalBottomSheet<SubtaskStatus>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
    ),
    builder: (sheetContext) => SafeArea(
      top: false,
      child: _SubtaskStatusSheet(subtask: subtask, sheetContext: sheetContext),
    ),
  );
}

class _SubtaskStatusSheet extends StatelessWidget {
  const _SubtaskStatusSheet({required this.subtask, required this.sheetContext});

  final Subtask subtask;
  final BuildContext sheetContext;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Statut de la sous-tâche',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtask.titre.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subtask.titre,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 12),
          for (final status in SubtaskStatus.values) ...[
            _StatusOption(
              status: status,
              selected: status == subtask.status,
              onTap: () => Navigator.of(sheetContext).pop(status),
            ),
            if (status != SubtaskStatus.values.last)
              const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }
}

class _StatusOption extends StatelessWidget {
  const _StatusOption({
    required this.status,
    required this.selected,
    required this.onTap,
  });

  final SubtaskStatus status;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      key: ValueKey('status-option-${status.name}'),
      color: selected
          ? AppColors.primaryTint
          : Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(
              color: selected
                  ? AppColors.primary.withValues(alpha: 0.4)
                  : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              TodoStatusControl(status: status, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  '${status.label} — ${status.progress} %',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? AppColors.primary
                        : AppColors.textPrimary,
                  ),
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_rounded,
                  size: 20,
                  color: AppColors.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
