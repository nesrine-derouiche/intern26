import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/subtask.dart';
import '../../models/tache.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../providers/tasks/task_subtasks_provider.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/status_pill.dart';
import '../../widgets/tasks/parent_task_summary.dart';
import '../../widgets/tasks/subtask_status_sheet.dart';
import '../../widgets/tasks/subtask_todo_list.dart';
import '../../widgets/tasks/todo_status_control.dart';

/// Task details redesigned as a Todo list: the parent task is the main card
/// (never a checkbox) and its subtasks form a Reminders-style checklist with
/// a three-state status control (TODO / IN_PROGRESS / DONE).
class TaskDetailsScreen extends ConsumerStatefulWidget {
  const TaskDetailsScreen({super.key, required this.task});

  final Tache task;

  @override
  ConsumerState<TaskDetailsScreen> createState() => _TaskDetailsScreenState();
}

class _TaskDetailsScreenState extends ConsumerState<TaskDetailsScreen> {
  final Set<String> _updatingIds = {};

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtasksAsync = ref.watch(taskSubtasksProvider(widget.task.id));
    final result = subtasksAsync.value;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Détails de la tâche'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(taskSubtasksProvider(widget.task.id));
          await ref.read(taskSubtasksProvider(widget.task.id).future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ParentHeader(task: widget.task, result: result),
                    const SizedBox(height: 20),
                    Text(
                      'Sous-tâches',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    subtasksAsync.when(
                      skipLoadingOnReload: true,
                      loading: () => const Padding(
                        padding: EdgeInsets.symmetric(vertical: 32),
                        child:
                            Center(child: CircularProgressIndicator()),
                      ),
                      error: (error, _) => ErrorView(
                        message: _errorMessage(error),
                        onRetry: () => ref.invalidate(
                          taskSubtasksProvider(widget.task.id),
                        ),
                      ),
                      data: (payload) {
                        final subtasks = payload.subtasks;
                        if (subtasks.isEmpty) {
                          return const EmptyState(
                            icon: Icons.checklist_outlined,
                            title: 'Aucune sous-tâche',
                            message:
                                'Votre encadrant n’a pas encore découpé cette tâche en sous-tâches.',
                          );
                        }
                        return SubtaskTodoList(
                          subtasks: subtasks,
                          updatingIds: _updatingIds,
                          onStatusControlTap: _onStatusControlTap,
                          onRowTap: _openSubtaskDetails,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onStatusControlTap(Subtask subtask) async {
    if (_updatingIds.contains(subtask.id) || !mounted) return;
    final selected = await showSubtaskStatusSheet(context, subtask: subtask);
    if (selected == null || !mounted) return;
    await _updateStatus(subtask, selected);
  }

  Future<void> _updateStatus(Subtask subtask, SubtaskStatus status) async {
    if (subtask.status == status || _updatingIds.contains(subtask.id)) {
      return;
    }
    setState(() => _updatingIds.add(subtask.id));
    try {
      await ref.read(tacheServiceProvider).updateSubtaskStatus(
            id: subtask.id,
            status: status,
          );
      ref.invalidate(taskSubtasksProvider(widget.task.id));
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(content: Text('Mise à jour échouée : ${error.message}')),
          );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(
              content: Text('Mise à jour échouée. Veuillez réessayer.'),
            ),
          );
      }
    } finally {
      if (mounted) setState(() => _updatingIds.remove(subtask.id));
    }
  }

  void _openSubtaskDetails(Subtask subtask) {
    final description = subtask.description?.trim() ?? '';
    final updatedAt = subtask.updatedAt;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTheme.radiusLg)),
      ),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                subtask.titre,
                style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              if (description.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  description,
                  style: Theme.of(sheetContext)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Text(
                    'Statut',
                    style: Theme.of(sheetContext)
                        .textTheme
                        .bodySmall
                        ?.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const Spacer(),
                  StatusPill(
                    label: subtask.status.label,
                    color: subtaskStatusColor(subtask.status),
                  ),
                ],
              ),
              if (updatedAt != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Dernière mise à jour : ${formatDateFr(updatedAt)}',
                  style: Theme.of(sheetContext)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _errorMessage(Object error) {
    if (error is ApiException) return error.message;
    return 'Chargement impossible. Veuillez réessayer.';
  }
}

class _ParentHeader extends StatelessWidget {
  const _ParentHeader({required this.task, required this.result});

  final Tache task;
  final SubtaskListResult? result;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
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
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              task.titre,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            if (task.description.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                task.description,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: 12),
            ParentTaskSummary(task: task, aggregate: aggregate),
          ],
        ),
      ),
    );
  }
}
