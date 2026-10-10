import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../models/personal_tache.dart';
import '../../models/tache.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../providers/personal_tache/personal_tache_providers.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/dashboard/personal_tache_card.dart';
import '../../widgets/dashboard/personal_tache_form.dart';
import '../../widgets/dashboard/tache_status_widgets.dart';
import '../../widgets/tasks/parent_task_card.dart';

class MyTasksScreen extends ConsumerStatefulWidget {
  const MyTasksScreen({super.key});

  @override
  ConsumerState<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends ConsumerState<MyTasksScreen> {
  TacheStatut? _activeFilter;

  @override
  Widget build(BuildContext context) {
    final tasksAsync = ref.watch(myTachesProvider);
    final sections = ref.watch(tachesSectionsProvider);
    final personalAsync = ref.watch(personalTachesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes tâches'),
      ),
      body: tasksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.refresh(myTachesProvider.future),
        ),
        data: (_) {
          final visibleSections = _activeFilter == null
              ? sections
              : sections
                  .where((section) => section.status == _activeFilter)
                  .toList();
          final total = sections.fold<int>(
            0,
            (sum, section) => sum + section.items.length,
          );

          return CustomScrollView(
            slivers: [
              if (total > 0)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                    child: _FilterChips(
                      sections: sections,
                      total: total,
                      activeFilter: _activeFilter,
                      onFilterChanged: (filter) {
                        setState(() => _activeFilter = filter);
                      },
                    ),
                  ),
                ),
              if (total == 0)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: EmptyState(
                      icon: Icons.checklist_outlined,
                      title: 'Aucune tâche assignée par votre encadrant.',
                      message:
                          'Les tâches que votre encadrant vous confie apparaîtront ici.',
                    ),
                  ),
                )
              else
                for (final section in visibleSections)
                  if (section.items.isNotEmpty) ...[
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: _SectionHeader(
                          status: section.status,
                          count: section.items.length,
                        ),
                      ),
                    ),
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final task = section.items[index];
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                            child: ParentTaskCard(
                              task: task,
                              onTap: () => context.push(
                                RoutePaths.taskDetails
                                    .replaceFirst(':id', task.id),
                                extra: task,
                              ),
                            ),
                          );
                        },
                        childCount: section.items.length,
                      ),
                    ),
                  ],
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Tâches personnelles',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Ajouter une tâche personnelle',
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: () => _openPersonalForm(context, null),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: personalAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                  error: (error, _) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Tâches personnelles indisponibles.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                  data: (tasks) {
                    if (tasks.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.fromLTRB(16, 0, 16, 24),
                        child: Text(
                          'Créez vos propres tâches pour organiser votre stage.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      );
                    }
                    return ReorderableListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
                      itemCount: tasks.length,
                      onReorder: (oldIndex, newIndex) {
                        if (newIndex > oldIndex) newIndex--;
                        if (oldIndex == newIndex) return;
                        final task = tasks[oldIndex];
                        ref.read(personalTachesProvider.notifier).moveTask(
                              task.id,
                              statut: task.statut,
                              position: newIndex,
                            );
                      },
                      itemBuilder: (context, index) {
                        final task = tasks[index];
                        return Padding(
                          key: ValueKey(task.id),
                          padding: const EdgeInsets.only(bottom: 6),
                          child: PersonalTacheCard(
                            tache: task,
                            onLongPress: () =>
                                _showPersonalActions(context, task),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openPersonalForm(BuildContext context, PersonalTache? task) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => PersonalTacheFormSheet(existing: task),
    );
  }

  void _showPersonalActions(BuildContext context, PersonalTache task) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  task.titre,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 8),
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Modifier'),
                onTap: () {
                  Navigator.pop(ctx);
                  _openPersonalForm(context, task);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.delete_outline, color: AppColors.danger),
                title: const Text('Supprimer',
                    style: TextStyle(color: AppColors.danger)),
                onTap: () async {
                  Navigator.pop(ctx);
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: const Text('Supprimer la tâche'),
                      content: Text('Supprimer « ${task.titre} » ?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(d, false),
                          child: const Text('Annuler'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(d, true),
                          child: const Text('Supprimer',
                              style: TextStyle(color: AppColors.danger)),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    final container = ProviderScope.containerOf(context);
                    container
                        .read(personalTachesProvider.notifier)
                        .delete(task.id);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.sections,
    required this.total,
    required this.activeFilter,
    required this.onFilterChanged,
  });

  final List<TacheSection> sections;
  final int total;
  final TacheStatut? activeFilter;
  final ValueChanged<TacheStatut?> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _FilterChipItem(
            label: 'Toutes',
            count: total,
            color: AppColors.primary,
            isSelected: activeFilter == null,
            onTap: () => onFilterChanged(null),
          ),
          const SizedBox(width: 6),
          for (final section in sections)
            if (section.items.isNotEmpty) ...[
              _FilterChipItem(
                label: section.status.label,
                count: section.items.length,
                color: TacheStatutBadge.color(section.status.value),
                isSelected: activeFilter == section.status,
                onTap: () => onFilterChanged(
                  activeFilter == section.status ? null : section.status,
                ),
              ),
              const SizedBox(width: 6),
            ],
        ],
      ),
    );
  }
}

class _FilterChipItem extends StatelessWidget {
  const _FilterChipItem({
    required this.label,
    required this.count,
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final int count;
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? color.withValues(alpha: 0.16)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected ? color : AppColors.border,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isSelected ? color : AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '$count',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isSelected ? color : AppColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.status, required this.count});

  final TacheStatut status;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: TacheStatutBadge.color(status.value),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          status.label,
          style: Theme.of(context)
              .textTheme
              .titleSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(width: 6),
        Text(
          '$count',
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
