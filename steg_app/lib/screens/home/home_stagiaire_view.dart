import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/stagiaire_overview.dart';
import '../../providers/pointage/pointage_providers.dart';
import '../../widgets/common/animated_progress.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_fade_in.dart';
import '../../widgets/common/skeleton_box.dart';
import '../../widgets/common/skeleton_card.dart';
import '../../widgets/common/status_pill.dart';
import '../../widgets/dashboard/stage_statut_badge.dart';
import '../../widgets/home/responsive_grid.dart';

class HomeStagiaireView extends StatelessWidget {
  const HomeStagiaireView({
    super.key,
    required this.overviewAsync,
    required this.onRefresh,
  });

  final AsyncValue<StagiaireOverview?> overviewAsync;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    if (overviewAsync.isLoading && overviewAsync.value == null) {
      return _buildSkeleton(context);
    }

    if (overviewAsync.hasError && overviewAsync.value == null) {
      return _buildError(context);
    }

    final overview = overviewAsync.value;

    if (overview == null || (!overview.hasStage && overview.tasks.total == 0)) {
      return _buildEmpty(context);
    }

    return _buildPopulated(context, overview);
  }

  Widget _buildSkeleton(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SkeletonBox(width: 60, height: 60, radius: 30),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SkeletonBox(width: 180, height: 20),
                          const SizedBox(height: 8),
                          SkeletonBox(width: 120, height: 14),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const SkeletonBox(width: double.infinity, height: 14),
                const SizedBox(height: 10),
                SkeletonBox(
                  width: MediaQuery.of(context).size.width * 0.6,
                  height: 8,
                  radius: 4,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const SkeletonCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 160, height: 18),
                SizedBox(height: 14),
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 10),
                SkeletonBox(width: 200, height: 14),
                SizedBox(height: 14),
                SkeletonBox(width: double.infinity, height: 8, radius: 4),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SkeletonCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBox(width: 140, height: 18),
                const SizedBox(height: 14),
                Row(
                  children: const [
                    Expanded(child: SkeletonBox(width: double.infinity, height: 48, radius: 12)),
                    SizedBox(width: 10),
                    Expanded(child: SkeletonBox(width: double.infinity, height: 48, radius: 12)),
                    SizedBox(width: 10),
                    Expanded(child: SkeletonBox(width: double.infinity, height: 48, radius: 12)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const SkeletonCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 180, height: 18),
                SizedBox(height: 12),
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 240, height: 14),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(22),
              ),
              child: const Icon(Icons.wifi_off_rounded, size: 32, color: AppColors.danger),
            ),
            const SizedBox(height: 20),
            Text(
              'Impossible de charger vos données',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Vérifiez votre connexion internet et réessayez.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    final userOverview = overviewAsync.value;
    final trainee = userOverview?.trainee;
    final name = trainee?.prenom.isNotEmpty == true ? trainee!.prenom : 'Stagiaire';

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      child: Column(
        children: [
          _EmptyWelcome(name: name),
          const SizedBox(height: 32),
          Icon(
            Icons.work_outline_rounded,
            size: 56,
            color: AppColors.textTertiary,
          ),
          const SizedBox(height: 16),
          Text(
            'Aucun stage actif',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            'Votre stage n\'a pas encore été créé. Consultez vos candidatures pour suivre l\'avancement.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => context.push(RoutePaths.mesCandidatures),
            icon: const Icon(Icons.fact_check_outlined, size: 18),
            label: const Text('Mes candidatures'),
          ),
        ],
      ),
    );
  }

  Widget _buildPopulated(BuildContext context, StagiaireOverview overview) {
    final nextDelay = ValueNotifier<int>(0);

    Widget staggered(Widget child) {
      final delay = nextDelay.value;
      nextDelay.value += 60;
      return AppFadeIn(
        delay: Duration(milliseconds: delay),
        offset: const Offset(0, 12),
        child: child,
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            staggered(_WelcomeSection(overview: overview)),
            const SizedBox(height: 24),
            if (overview.hasStage)
              staggered(_InternshipSection(internship: overview.internship!)),
            if (overview.project != null) ...[
              const SizedBox(height: 16),
              staggered(_ProjectSection(project: overview.project!)),
            ],
            const SizedBox(height: 16),
            staggered(_TasksSection(tasks: overview.tasks)),
            if (overview.hasStage) ...[
              const SizedBox(height: 16),
              staggered(const _PresenceSection()),
            ],
            if (overview.hasStage) ...[
              const SizedBox(height: 16),
              staggered(const _PlanningSection()),
            ],
            if (overview.upcomingMeetings.isNotEmpty) ...[
              const SizedBox(height: 16),
              staggered(_MeetingsSection(meetings: overview.upcomingMeetings)),
            ],
            if (overview.journal != null) ...[
              const SizedBox(height: 16),
              staggered(_JournalSection(journal: overview.journal!)),
            ],
            if (overview.evaluation != null) ...[
              const SizedBox(height: 16),
              staggered(_EvaluationSection(evaluation: overview.evaluation!)),
            ],
          ],
        ),
      ),
    );
  }
}

class _WelcomeSection extends StatelessWidget {
  const _WelcomeSection({required this.overview});
  final StagiaireOverview overview;

  @override
  Widget build(BuildContext context) {
    final trainee = overview.trainee;
    final internship = overview.internship;
    final firstName = trainee?.prenom.isNotEmpty == true ? trainee!.prenom : 'Stagiaire';
    final fullName = trainee?.fullName ?? '';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -20,
            top: -30,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.14),
                    Colors.white.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bonjour, $firstName \u{1F44B}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                        if (fullName.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (internship != null)
                    StageStatutBadge(statut: internship.status),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InternshipSection extends StatelessWidget {
  const _InternshipSection({required this.internship});
  final OverviewInternship internship;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = internship.progress;
    final start = internship.startDate;
    final end = internship.endDate;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  gradient: AppColors.brandGradient,
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.work_outline, size: 20, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mon stage',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      internship.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (internship.supervisor != null) ...[
            _InfoRow(icon: Icons.person_outline, label: internship.supervisor!.fullName),
            const SizedBox(height: 8),
          ],
          _InfoRow(
            icon: Icons.date_range_outlined,
            label: _dateRangeLabel(start, end),
          ),
          if (start != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: AnimatedLinearProgress(
                    value: progress / 100,
                    minHeight: 8,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '$progress%',
                  style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              _remainingLabel(internship),
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
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

  static String _remainingLabel(OverviewInternship internship) {
    final end = internship.endDate;
    if (end == null) return '';
    final remaining = dateOnly(end).difference(dateOnly(DateTime.now())).inDays;
    if (remaining < 0) return 'Stage terminé';
    if (remaining == 0) return 'Dernier jour';
    return '$remaining jour${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}';
  }
}

class _ProjectSection extends StatelessWidget {
  const _ProjectSection({required this.project});
  final OverviewProject project;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = project.avancement;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.violet.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.rocket_launch_outlined, size: 20, color: AppColors.violet),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mon projet',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Text(
                      project.titre,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (project.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              project.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: AnimatedLinearProgress(
                  value: progress / 100,
                  minHeight: 8,
                  color: AppColors.violet,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '$progress%',
                style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push(RoutePaths.monProjet),
              icon: const Icon(Icons.rocket_launch_outlined, size: 16),
              label: const Text('Voir le projet'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TasksSection extends StatelessWidget {
  const _TasksSection({required this.tasks});
  final OverviewTaskStats tasks;

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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.checklist_outlined, size: 20, color: AppColors.info),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Mes tâches',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              if (tasks.total > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${tasks.total}',
                    style: const TextStyle(
                      color: AppColors.info,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          if (tasks.total > 0) ...[
            const SizedBox(height: 16),
            ResponsiveGrid(
              itemCount: 3,
              maxCrossAxisExtent: 150,
              childAspectRatio: 1.35,
              itemBuilder: (context, index) {
                final items = [
                  _TaskStatItem(
                    count: tasks.todo,
                    label: 'À faire',
                    color: AppColors.warning,
                  ),
                  _TaskStatItem(
                    count: tasks.inProgress,
                    label: 'En cours',
                    color: AppColors.info,
                  ),
                  _TaskStatItem(
                    count: tasks.completed,
                    label: 'Terminées',
                    color: AppColors.success,
                  ),
                ];
                return items[index];
              },
            ),
            if (tasks.overdue > 0) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.danger),
                    const SizedBox(width: 8),
                    Text(
                      '${tasks.overdue} tâche${tasks.overdue > 1 ? 's' : ''} en retard',
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ] else ...[
            const SizedBox(height: 16),
            Text(
              'Aucune tâche assignée pour le moment.',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.go(RoutePaths.mesTaches),
              icon: const Icon(Icons.arrow_forward, size: 16),
              label: const Text('Voir toutes les tâches'),
            ),
          ),
        ],
      ),
    );
  }
}

class _TaskStatItem extends StatelessWidget {
  const _TaskStatItem({
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
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedCounter(
            value: count,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MeetingsSection extends StatelessWidget {
  const _MeetingsSection({required this.meetings});
  final List<OverviewMeeting> meetings;

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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.event_outlined, size: 20, color: AppColors.success),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Prochaines réunions',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              if (meetings.length > 3)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '${meetings.length}',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ...meetings.take(3).map((m) => _MeetingTile(meeting: m)),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push(RoutePaths.calendrier),
              icon: const Icon(Icons.calendar_month_outlined, size: 16),
              label: const Text('Voir le calendrier'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MeetingTile extends StatelessWidget {
  const _MeetingTile({required this.meeting});
  final OverviewMeeting meeting;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.event_outlined, size: 16, color: AppColors.success),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meeting.sujet.isNotEmpty ? meeting.sujet : 'Réunion',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      _meetingDateLabel(meeting),
                      style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                    ),
                    if (meeting.salle != null && meeting.salle!.isNotEmpty) ...[
                      Text(
                        ' · ${meeting.salle}',
                        style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          StatusPill(
            label: meeting.heureLabel,
            color: AppColors.success,
            dot: false,
          ),
        ],
      ),
    );
  }

  static String _meetingDateLabel(OverviewMeeting meeting) {
    final date = meeting.date;
    if (date == null) return '';
    return formatRelativeDayFr(date);
  }
}

class _PlanningSection extends StatelessWidget {
  const _PlanningSection();

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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(
                  Icons.event_note_outlined,
                  size: 20,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Mon planning',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Réunions, échéances et pointages de la période',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push(RoutePaths.planning),
              icon: const Icon(Icons.calendar_view_month_outlined, size: 16),
              label: const Text('Voir le planning'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PresenceSection extends ConsumerWidget {
  const _PresenceSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final pointageAsync = ref.watch(pointageProvider);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.teal.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.fingerprint, size: 20, color: AppColors.teal),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Présences',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          pointageAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (error, stackTrace) => Text(
              'Impossible de charger le pointage',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
            ),
            data: (state) {
              final pointage = state.todayPointage;
              if (pointage == null) {
                return Column(
                  children: [
                    Text(
                      'Aucun pointage aujourd\'hui',
                      style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pointez votre entrée pour commencer',
                      style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
                    ),
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(
                    child: _PresenceMiniStat(
                      icon: Icons.login,
                      label: 'Entrée',
                      value: pointage.heureEntreeLabel,
                      color: AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _PresenceMiniStat(
                      icon: Icons.logout,
                      label: 'Sortie',
                      value: pointage.hasExit ? pointage.heureSortieLabel : '—',
                      color: pointage.hasExit ? AppColors.info : AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _PresenceMiniStat(
                      icon: Icons.timer_outlined,
                      label: 'Durée',
                      value: pointage.hasEntry ? pointage.dureeLabel : '—',
                      color: AppColors.primary,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push(RoutePaths.pointage),
              icon: const Icon(Icons.fingerprint, size: 16),
              label: const Text('Ouvrir le pointage'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PresenceMiniStat extends StatelessWidget {
  const _PresenceMiniStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceTone,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 4),
          Text(
            value,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontSize: 11,
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}

class _JournalSection extends StatelessWidget {
  const _JournalSection({required this.journal});
  final OverviewJournalStats journal;

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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.violet.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.menu_book_outlined, size: 20, color: AppColors.violet),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Journal hebdomadaire',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _JournalStat(
                count: journal.submitted,
                label: 'Soumis',
                color: AppColors.success,
              ),
              const SizedBox(width: 16),
              _JournalStat(
                count: journal.pending,
                label: 'Brouillons',
                color: AppColors.warning,
              ),
              const SizedBox(width: 16),
              _JournalStat(
                count: journal.total,
                label: 'Total',
                color: AppColors.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push(RoutePaths.journal),
              icon: const Icon(Icons.arrow_forward, size: 16),
              label: const Text('Voir le journal'),
            ),
          ),
        ],
      ),
    );
  }
}

class _JournalStat extends StatelessWidget {
  const _JournalStat({
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
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
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

class _EvaluationSection extends StatelessWidget {
  const _EvaluationSection({required this.evaluation});
  final OverviewEvaluation evaluation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final note = evaluation.noteFinale;

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: evaluation.validee
                  ? AppColors.success.withValues(alpha: 0.12)
                  : AppColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              evaluation.validee ? Icons.verified_outlined : Icons.grading_outlined,
              size: 20,
              color: evaluation.validee ? AppColors.success : AppColors.warning,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Évaluation',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  evaluation.validee
                      ? (note != null ? 'Note finale : ${note.toStringAsFixed(1)}/20' : 'Évaluation validée')
                      : 'En attente de validation',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: evaluation.validee ? AppColors.success : AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (note != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _noteColor(note).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                note.toStringAsFixed(1),
                style: TextStyle(
                  color: _noteColor(note),
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
        ],
      ),
    );
  }

  static Color _noteColor(double note) {
    if (note >= 16) return AppColors.success;
    if (note >= 12) return AppColors.info;
    if (note >= 10) return AppColors.warning;
    return AppColors.danger;
  }
}

class _EmptyWelcome extends StatelessWidget {
  const _EmptyWelcome({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Text(
        'Bonjour, $name \u{1F44B}',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 22,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label});
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
