import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/personal_tache.dart';
import '../../models/tache.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../providers/personal_tache/personal_tache_providers.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/dashboard/dashboard_skeletons.dart';
import '../../widgets/dashboard/personal_tache_card.dart';
import '../../widgets/dashboard/personal_tache_form.dart';
import '../../widgets/dashboard/tache_card.dart';
import '../../widgets/dashboard/tache_status_widgets.dart';

final activeTaskFilterProvider =
    NotifierProvider<ActiveTaskFilter, TacheStatut?>(ActiveTaskFilter.new);

class ActiveTaskFilter extends Notifier<TacheStatut?> {
  @override
  TacheStatut? build() => null;

  void select(TacheStatut? filter) => state = filter;
}

class MyTasksScreen extends ConsumerStatefulWidget {
  const MyTasksScreen({super.key});

  @override
  ConsumerState<MyTasksScreen> createState() => _MyTasksScreenState();
}

class _MyTasksScreenState extends ConsumerState<MyTasksScreen> {
  @override
  Widget build(BuildContext context) {
    final tachesAsync = ref.watch(myTachesProvider);
    final sections = ref.watch(tachesSectionsProvider);
    final activeFilter = ref.watch(activeTaskFilterProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Mes tâches'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myTachesProvider);
          ref.invalidate(personalTachesProvider);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ═══ SECTION 1: Tâches de l'encadrant ═══
            SliverToBoxAdapter(
              child: _SectionEncadrantHeader(
                tachesAsync: tachesAsync,
                sections: sections,
                activeFilter: activeFilter,
              ),
            ),
            ..._buildEncadrantSlivers(tachesAsync, sections, activeFilter),

            // ═══ SECTION 2: Mon tableau personnel ═══
            const SliverToBoxAdapter(child: _SectionPersonalHeader()),
            const SliverToBoxAdapter(child: _PersonalBoard()),
            SliverPadding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewPadding.bottom + 80,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildEncadrantSlivers(
    AsyncValue<List<Tache>> tachesAsync,
    List<TacheSection> sections,
    TacheStatut? activeFilter,
  ) {
    if (tachesAsync.isLoading && !tachesAsync.hasValue) {
      return [
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (_, index) => const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: TacheCardSkeleton(),
              ),
              childCount: 3,
            ),
          ),
        ),
      ];
    }

    if (tachesAsync.hasError && !tachesAsync.hasValue) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: ErrorView(
            message: tachesAsync.error.toString(),
            onRetry: () => ref.refresh(myTachesProvider.future),
          ),
        ),
      ];
    }

    final total = sections.fold<int>(0, (sum, s) => sum + s.items.length);
    if (total == 0) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'Aucune tâche assignée par votre encadrant.',
              style: TextStyle(color: AppColors.textTertiary, fontSize: 13),
            ),
          ),
        ),
      ];
    }

    final visibleSections = activeFilter != null
        ? sections.where((s) => s.status == activeFilter).toList()
        : sections;

    return [
      SliverToBoxAdapter(
        child: _FilterChips(
          sections: sections,
          activeFilter: activeFilter,
          onFilterChanged: (f) => ref.read(activeTaskFilterProvider.notifier).select(f),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final section = visibleSections[index];
              if (section.items.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SectionSubHeader(section: section),
                  const SizedBox(height: 8),
                  for (final tache in section.items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: TacheCard(tache: tache),
                    ),
                ],
              );
            },
            childCount: visibleSections.length,
          ),
        ),
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════
// Section 1 Header — Tâches de mon encadrant
// ═══════════════════════════════════════════════════════════════
class _SectionEncadrantHeader extends StatelessWidget {
  const _SectionEncadrantHeader({
    required this.tachesAsync,
    required this.sections,
    required this.activeFilter,
  });

  final AsyncValue<List<Tache>> tachesAsync;
  final List<TacheSection> sections;
  final TacheStatut? activeFilter;

  @override
  Widget build(BuildContext context) {
    final total = sections.fold<int>(0, (sum, s) => sum + s.items.length);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.primaryTint.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.school_outlined, size: 18, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tâches de mon encadrant',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$total tâche${total > 1 ? 's' : ''} assignée${total > 1 ? 's' : ''}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.lock_outline, size: 16, color: AppColors.textTertiary),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Section 2 Header — Mon tableau personnel
// ═══════════════════════════════════════════════════════════════
class _SectionPersonalHeader extends StatelessWidget {
  const _SectionPersonalHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.violet.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.violet.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.dashboard_outlined, size: 18, color: AppColors.violet),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mon tableau',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Organise ton travail personnel',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Trello Board — 3 columns with Drag & Drop
// ═══════════════════════════════════════════════════════════════
class _PersonalBoard extends ConsumerWidget {
  const _PersonalBoard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final personalAsync = ref.watch(personalTachesProvider);

    return personalAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: ErrorView(
          message: e.toString(),
          onRetry: () => ref.refresh(personalTachesProvider.future),
        ),
      ),
      data: (tasks) {
        final af = tasks.where((t) => t.isAFaire).toList()
          ..sort((a, b) => a.position.compareTo(b.position));
        final ec = tasks.where((t) => t.isEnCours).toList()
          ..sort((a, b) => a.position.compareTo(b.position));
        final done = tasks.where((t) => t.isTerminee).toList()
          ..sort((a, b) => a.position.compareTo(b.position));

        final screen = MediaQuery.of(context);
        final boardHeight = (screen.size.height * 0.42).clamp(340.0, 480.0);
        final columnWidth = ((screen.size.width - 44) * 0.85).clamp(220.0, 380.0);

        return SizedBox(
          height: boardHeight,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              _TrelloColumn(
                columnWidth: columnWidth,
                title: 'À faire',
                icon: Icons.pending_outlined,
                color: AppColors.warning,
                tasks: af,
                emptyMessage: 'Aucune tâche ici',
                onAdd: () => _showAddForm(context),
                onTaskTap: (t) => _showEditForm(context, t),
                onAccept: (task, newPos) => _moveTask(ref, task, 'A_FAIRE', newPos),
                onReorder: (task, newPos) => _moveTask(ref, task, 'A_FAIRE', newPos),
              ),
              const SizedBox(width: 12),
              _TrelloColumn(
                columnWidth: columnWidth,
                title: 'En cours',
                icon: Icons.play_circle_outline,
                color: AppColors.info,
                tasks: ec,
                emptyMessage: 'Aucune tâche ici',
                onAdd: () => _showAddForm(context),
                onTaskTap: (t) => _showEditForm(context, t),
                onAccept: (task, newPos) => _moveTask(ref, task, 'EN_COURS', newPos),
                onReorder: (task, newPos) => _moveTask(ref, task, 'EN_COURS', newPos),
              ),
              const SizedBox(width: 12),
              _TrelloColumn(
                columnWidth: columnWidth,
                title: 'Terminée',
                icon: Icons.check_circle_outline,
                color: AppColors.success,
                tasks: done,
                emptyMessage: 'Aucune tâche ici',
                onAdd: () => _showAddForm(context),
                onTaskTap: (t) => _showEditForm(context, t),
                onAccept: (task, newPos) => _moveTask(ref, task, 'TERMINEE', newPos),
                onReorder: (task, newPos) => _moveTask(ref, task, 'TERMINEE', newPos),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _moveTask(WidgetRef ref, PersonalTache task, String statut, int position) async {
    try {
      await ref.read(personalTachesProvider.notifier).moveTask(
        task.id,
        statut: statut,
        position: position,
      );
    } catch (e) {
      if (ref.context.mounted) {
        ScaffoldMessenger.of(ref.context).showSnackBar(
          SnackBar(content: Text('Erreur de déplacement : $e')),
        );
      }
    }
  }

  void _showAddForm(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const PersonalTacheFormSheet(),
    );
  }

  void _showEditForm(BuildContext context, PersonalTache task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => PersonalTacheFormSheet(existing: task),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Trello Column Widget
// ═══════════════════════════════════════════════════════════════
class _TrelloColumn extends StatelessWidget {
  const _TrelloColumn({
    required this.title,
    required this.icon,
    required this.color,
    required this.tasks,
    required this.emptyMessage,
    required this.columnWidth,
    this.onAdd,
    this.onTaskTap,
    required this.onAccept,
    required this.onReorder,
  });

  final String title;
  final IconData icon;
  final Color color;
  final List<PersonalTache> tasks;
  final String emptyMessage;
  final double columnWidth;
  final VoidCallback? onAdd;
  final ValueChanged<PersonalTache>? onTaskTap;
  final void Function(PersonalTache task, int position) onAccept;
  final void Function(PersonalTache task, int position) onReorder;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: columnWidth,
      child: DragTarget<PersonalTache>(
        onWillAcceptWithDetails: (details) {
          final dragged = details.data;
          final isSameColumn = tasks.any((t) => t.id == dragged.id);
          return !isSameColumn;
        },
        onAcceptWithDetails: (details) {
          onAccept(details.data, tasks.length);
        },
        builder: (context, candidateData, rejectedData) {
          final isHovering = candidateData.isNotEmpty;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: isHovering
                  ? color.withValues(alpha: 0.06)
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isHovering ? color.withValues(alpha: 0.4) : AppColors.border,
                width: isHovering ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Column header
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                  child: Row(
                    children: [
                      Icon(icon, size: 16, color: color),
                      const SizedBox(width: 6),
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: color,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${tasks.length}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, indent: 14, endIndent: 14),
                // Task list
                Expanded(
                  child: tasks.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(icon, size: 28, color: AppColors.textTertiary.withValues(alpha: 0.4)),
                                const SizedBox(height: 8),
                                Text(
                                  emptyMessage,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textTertiary,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        )
                      : ReorderableListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          itemCount: tasks.length,
                          onReorder: (oldIndex, newIndex) {
                            if (newIndex > oldIndex) newIndex--;
                            if (oldIndex == newIndex) return;
                            onReorder(tasks[oldIndex], newIndex);
                          },
                          itemBuilder: (context, index) {
                            final task = tasks[index];
                            return Padding(
                              key: ValueKey(task.id),
                              padding: const EdgeInsets.only(bottom: 6),
                              child: PersonalTacheCard(
                                tache: task,
                                onTap: () => onTaskTap?.call(task),
                                onLongPress: () => _showTaskActions(context, task),
                              ),
                            );
                          },
                        ),
                ),
                // Add button
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: onAdd,
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Ajouter'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: color,
                        side: BorderSide(color: color.withValues(alpha: 0.3)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showTaskActions(BuildContext context, PersonalTache task) {
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
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
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
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    builder: (_) => PersonalTacheFormSheet(existing: task),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: AppColors.danger),
                title: const Text('Supprimer', style: TextStyle(color: AppColors.danger)),
                onTap: () async {
                  Navigator.pop(ctx);
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: const Text('Supprimer la tâche'),
                      content: Text('Supprimer « ${task.titre} » ?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Annuler')),
                        TextButton(
                          onPressed: () => Navigator.pop(d, true),
                          child: const Text('Supprimer', style: TextStyle(color: AppColors.danger)),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    final container = ProviderScope.containerOf(context);
                    container.read(personalTachesProvider.notifier).delete(task.id);
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

// ═══════════════════════════════════════════════════════════════
// Filter Chips for encadrant tasks
// ═══════════════════════════════════════════════════════════════
class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.sections,
    required this.activeFilter,
    required this.onFilterChanged,
  });

  final List<TacheSection> sections;
  final TacheStatut? activeFilter;
  final ValueChanged<TacheStatut?> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        children: [
          _FilterChipItem(
            label: 'Toutes',
            count: sections.fold<int>(0, (sum, s) => sum + s.items.length),
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
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.15) : color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : color.withValues(alpha: 0.15),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$count',
              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: theme.textTheme.labelMedium?.copyWith(
                color: isSelected ? color : AppColors.textSecondary,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionSubHeader extends StatelessWidget {
  const _SectionSubHeader({required this.section});
  final TacheSection section;

  @override
  Widget build(BuildContext context) {
    final status = section.status;
    final color = TacheStatutBadge.color(status.value);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
      child: Row(
        children: [
          Icon(
            switch (status) {
              TacheStatut.aFaire => Icons.pending_outlined,
              TacheStatut.enCours => Icons.play_circle_outline,
              TacheStatut.terminee => Icons.check_circle_outline,
              TacheStatut.bloquee => Icons.block_outlined,
            },
            size: 14,
            color: color,
          ),
          const SizedBox(width: 6),
          Text(
            status.label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '${section.items.length}',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
