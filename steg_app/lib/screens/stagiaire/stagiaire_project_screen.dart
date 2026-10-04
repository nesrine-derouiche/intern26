import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/stagiaire_project.dart';
import '../../providers/stagiaire/stagiaire_project_provider.dart';
import '../../widgets/common/animated_progress.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_fade_in.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/skeleton_box.dart';
import '../../widgets/common/skeleton_card.dart';
import '../../widgets/common/status_pill.dart';

class StagiaireProjectScreen extends ConsumerWidget {
  const StagiaireProjectScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(stagiaireProjectProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Mon projet'),
      ),
      body: _buildBody(context, ref, projectAsync),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<StagiaireProject?> projectAsync,
  ) {
    if (projectAsync.isLoading && projectAsync.value == null) {
      return _buildSkeleton(context);
    }

    if (projectAsync.hasError && projectAsync.value == null) {
      return ErrorView(
        message: projectAsync.error.toString(),
        onRetry: () => ref.refresh(stagiaireProjectProvider.future),
      );
    }

    final data = projectAsync.value;
    if (data == null || data.project.id.isEmpty) {
      return const EmptyState(
        icon: Icons.rocket_launch_outlined,
        title: 'Aucun projet',
        message: 'Votre projet de stage n\'a pas encore été créé.',
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.refresh(stagiaireProjectProvider.future),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final horizontalPadding = constraints.maxWidth > 600 ? 32.0 : 20.0;
          final maxWidth = constraints.maxWidth > 600 ? 600.0 : constraints.maxWidth;
          return Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppFadeIn(child: _ProjectHeader(project: data.project)),
                    const SizedBox(height: 20),
                    AppFadeIn(
                      delay: const Duration(milliseconds: 80),
                      child: _ProgressSection(project: data.project),
                    ),
                    if (data.project.description.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      AppFadeIn(
                        delay: const Duration(milliseconds: 120),
                        child: _DescriptionSection(description: data.project.description),
                      ),
                    ],
                    if (data.project.supervisor != null) ...[
                      const SizedBox(height: 16),
                      AppFadeIn(
                        delay: const Duration(milliseconds: 160),
                        child: _SupervisorSection(supervisor: data.project.supervisor!),
                      ),
                    ],
                    if (data.project.technologies.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      AppFadeIn(
                        delay: const Duration(milliseconds: 200),
                        child: _TechnologiesSection(technologies: data.project.technologies),
                      ),
                    ],
                    const SizedBox(height: 16),
                    AppFadeIn(
                      delay: const Duration(milliseconds: 240),
                      child: _TasksSummarySection(stats: data.tasks),
                    ),
                    if (data.stage.id.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      AppFadeIn(
                        delay: const Duration(milliseconds: 280),
                        child: _StageInfoSection(stage: data.stage),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSkeleton(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final horizontalPadding = constraints.maxWidth > 600 ? 32.0 : 20.0;
        final maxWidth = constraints.maxWidth > 600 ? 600.0 : constraints.maxWidth;
        return Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: SingleChildScrollView(
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SkeletonCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(width: 200, height: 24),
                        SizedBox(height: 10),
                        SkeletonBox(width: double.infinity, height: 14),
                        SizedBox(height: 8),
                        SkeletonBox(width: 160, height: 14),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  const SkeletonCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(width: 160, height: 18),
                        SizedBox(height: 14),
                        SkeletonBox(width: double.infinity, height: 8, radius: 4),
                        SizedBox(height: 10),
                        SkeletonBox(width: 120, height: 14),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  const SkeletonCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(width: 140, height: 18),
                        SizedBox(height: 12),
                        SkeletonBox(width: double.infinity, height: 14),
                        SizedBox(height: 8),
                        SkeletonBox(width: 240, height: 14),
                        SizedBox(height: 8),
                        SkeletonBox(width: 180, height: 14),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ProjectHeader extends StatelessWidget {
  const _ProjectHeader({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.violet,
            AppColors.violet.withValues(alpha: 0.7),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.violet.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.rocket_launch_outlined,
                  size: 24,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project.titre,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    if (project.departement != null &&
                        project.departement!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        project.departement!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.78),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (project.etat.isNotEmpty) ...[
            const SizedBox(height: 16),
            StatusPill(
              label: project.etat.replaceAll('_', ' '),
              color: Colors.white,
              dot: false,
            ),
          ],
        ],
      ),
    );
  }
}

class _ProgressSection extends StatelessWidget {
  const _ProgressSection({required this.project});
  final ProjectDetail project;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = project.avancement;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Progression',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: AnimatedLinearProgress(
                  value: progress / 100,
                  minHeight: 10,
                  color: AppColors.violet,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                '$progress%',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.violet,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DescriptionSection extends StatelessWidget {
  const _DescriptionSection({required this.description});
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.description_outlined, size: 18, color: AppColors.info),
              ),
              const SizedBox(width: 10),
              Text(
                'Description',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            description,
            style: theme.textTheme.bodyMedium?.copyWith(
              height: 1.6,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SupervisorSection extends StatelessWidget {
  const _SupervisorSection({required this.supervisor});
  final ProjectSupervisor supervisor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(Icons.person_outline, size: 20, color: AppColors.success),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Encadrant',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  supervisor.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TechnologiesSection extends StatelessWidget {
  const _TechnologiesSection({required this.technologies});
  final String technologies;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final techs = technologies.split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.code_outlined, size: 18, color: AppColors.warning),
              ),
              const SizedBox(width: 10),
              Text(
                'Technologies',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              for (final tech in techs)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.warning.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    tech,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: AppColors.warning,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TasksSummarySection extends StatelessWidget {
  const _TasksSummarySection({required this.stats});
  final ProjectTaskStats stats;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.checklist_outlined, size: 18, color: AppColors.info),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Tâches du projet',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              if (stats.total > 0)
                StatusPill(
                  label: '${stats.total}',
                  color: AppColors.info,
                ),
            ],
          ),
          if (stats.total > 0) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                _TaskStatChip(count: stats.todo, label: 'À faire', color: AppColors.warning),
                const SizedBox(width: 8),
                _TaskStatChip(count: stats.inProgress, label: 'En cours', color: AppColors.info),
                const SizedBox(width: 8),
                _TaskStatChip(count: stats.completed, label: 'Terminées', color: AppColors.success),
              ],
            ),
            if (stats.blocked > 0 || stats.overdue > 0) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  if (stats.blocked > 0)
                    _TaskStatChip(count: stats.blocked, label: 'Bloquées', color: AppColors.danger),
                  if (stats.blocked > 0 && stats.overdue > 0) const SizedBox(width: 8),
                  if (stats.overdue > 0)
                    _TaskStatChip(count: stats.overdue, label: 'En retard', color: AppColors.danger),
                ],
              ),
            ],
          ] else ...[
            const SizedBox(height: 12),
            Text(
              'Aucune tâche assignée pour le moment.',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

class _TaskStatChip extends StatelessWidget {
  const _TaskStatChip({
    required this.count,
    required this.label,
    required this.color,
  });

  final int count;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StageInfoSection extends StatelessWidget {
  const _StageInfoSection({required this.stage});
  final ProjectStage stage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.work_outline, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Text(
                'Stage associé',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _StageInfoRow(
            icon: Icons.date_range_outlined,
            label: _dateRangeLabel(stage.dateDebut, stage.dateFin),
          ),
          if (stage.statut.isNotEmpty) ...[
            const SizedBox(height: 8),
            _StageInfoRow(
              icon: Icons.flag_outlined,
              label: 'Statut : ${stage.statut.replaceAll('_', ' ')}',
            ),
          ],
        ],
      ),
    );
  }

  static String _dateRangeLabel(DateTime? start, DateTime? end) {
    if (start == null && end == null) return 'Dates non renseignées';
    if (end == null) return 'Depuis le ${formatDateFr(start)}';
    if (start == null) return 'Jusqu\'au ${formatDateFr(end)}';
    return 'Du ${formatDateFr(start)} au ${formatDateFr(end)}';
  }
}

class _StageInfoRow extends StatelessWidget {
  const _StageInfoRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
