import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/app_notification.dart';
import '../../models/dashboard_stats.dart';
import '../../models/document_item.dart';
import '../../models/internship.dart';
import '../../models/reunion.dart';
import '../../models/supervisor_info.dart';
import '../../models/tache.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/common/animated_progress.dart';
import '../../widgets/common/app_avatar.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_card_header.dart';
import '../../widgets/common/app_fade_in.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/dashboard/dashboard_skeletons.dart';
import '../../widgets/dashboard/department_card.dart';
import '../../widgets/dashboard/document_card.dart';
import '../../widgets/dashboard/internship_card.dart';
import '../../widgets/dashboard/notification_card.dart';
import '../../widgets/dashboard/reunion_card.dart';
import '../../widgets/dashboard/section_header.dart';
import '../../widgets/dashboard/stat_tile.dart';
import '../../widgets/dashboard/supervisor_card.dart';
import '../../widgets/dashboard/tache_card.dart';
import '../../widgets/home/activity_tile.dart';

class InternDashboardScreen extends ConsumerWidget {
  const InternDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).value?.session?.user;
    final statsAsync = ref.watch(dashboardStatsProvider);
    final tachesAsync = ref.watch(myTachesProvider);
    final notificationsAsync = ref.watch(myNotificationsProvider);
    final supervisor = ref.watch(mySupervisorProvider);
    final unread = ref.watch(unreadNotificationsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Tableau de bord'),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go(RoutePaths.mesNotifications),
            icon: Badge.count(
              count: unread,
              isLabelVisible: unread > 0,
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
        ],
      ),
      body: _buildBody(
        context,
        ref,
        user: user,
        statsAsync: statsAsync,
        tachesAsync: tachesAsync,
        notificationsAsync: notificationsAsync,
        supervisor: supervisor,
        unread: unread,
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref, {
    required User? user,
    required AsyncValue<DashboardStats> statsAsync,
    required AsyncValue<List<Tache>> tachesAsync,
    required AsyncValue<List<AppNotification>> notificationsAsync,
    required SupervisorInfo? supervisor,
    required int unread,
  }) {
    if (user?.role != 'STAGIAIRE') {
      return const EmptyState(
        icon: Icons.dashboard_customize_outlined,
        title: 'Tableau de bord indisponible',
        message: 'Ce tableau de bord est réservé aux stagiaires.',
      );
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 350),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      child: _buildContent(
        context,
        ref,
        user: user,
        statsAsync: statsAsync,
        tachesAsync: tachesAsync,
        notificationsAsync: notificationsAsync,
        supervisor: supervisor,
        unread: unread,
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    WidgetRef ref, {
    required User? user,
    required AsyncValue<DashboardStats> statsAsync,
    required AsyncValue<List<Tache>> tachesAsync,
    required AsyncValue<List<AppNotification>> notificationsAsync,
    required SupervisorInfo? supervisor,
    required int unread,
  }) {
    if (statsAsync.isLoading && !statsAsync.hasValue) {
      return const DashboardSkeleton(key: ValueKey('dashboard-skeleton'));
    }

    if (statsAsync.hasError && !statsAsync.hasValue) {
      return ErrorView(
        key: const ValueKey('dashboard-error'),
        message: statsAsync.error.toString(),
        onRetry: () => ref.refresh(dashboardStatsProvider.future),
      );
    }

    final stats = statsAsync.value;
    if (stats == null) return const SizedBox.shrink();

    final taches = tachesAsync.value ?? const <Tache>[];
    final notifications = notificationsAsync.value ?? const <AppNotification>[];
    final internship = stats.internship;

    final today = dateOnly(DateTime.now());
    final todayMeetings = stats.prochainesReunions
        .where((r) => r.date != null && dateOnly(r.date!) == today)
        .toList();
    final tachesRestantes = (stats.tachesTotal - stats.tachesTerminees)
        .clamp(0, stats.tachesTotal);
    final joursRestants = _joursRestants(internship);

    return RefreshIndicator(
      key: const ValueKey('dashboard-content'),
      onRefresh: () => Future.wait([
        ref.refresh(dashboardStatsProvider.future),
        ref.refresh(myTachesProvider.future),
        ref.refresh(myReunionsProvider.future),
        ref.refresh(myNotificationsProvider.future),
      ]),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          AppFadeIn(
            child: _HeroCard(
              user: user!,
              internship: internship,
              unread: unread,
              tachesRestantes: tachesRestantes,
              joursRestants: joursRestants,
              todayMeetings: todayMeetings.length,
            ),
          ),
          const SizedBox(height: 20),
          AppFadeIn(
            delay: const Duration(milliseconds: 80),
            child: _StatGrid(
              stats: stats,
              unread: unread,
              onTapTasks: () => context.go(RoutePaths.mesTaches),
              onTapMeetings: () => context.push(RoutePaths.mesReunions),
              onTapNotifications: () => context.go(RoutePaths.mesNotifications),
            ),
          ),
          const SizedBox(height: 24),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 900;
              final mainColumn = _buildMainColumn(
                context,
                ref,
                stats: stats,
                internship: internship,
                taches: taches,
                todayMeetings: todayMeetings,
                tachesRestantes: tachesRestantes,
              );
              final sidebar = _buildSidebar(
                context,
                ref,
                stats: stats,
                internship: internship,
                taches: taches,
                notifications: notifications,
                supervisor: supervisor,
              );

              if (wide) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 3, child: mainColumn),
                    const SizedBox(width: 20),
                    Expanded(flex: 2, child: sidebar),
                  ],
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  mainColumn,
                  const SizedBox(height: 8),
                  sidebar,
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMainColumn(
    BuildContext context,
    WidgetRef ref, {
    required DashboardStats stats,
    required Internship? internship,
    required List<Tache> taches,
    required List<Reunion> todayMeetings,
    required int tachesRestantes,
  }) {
    final todayTasks = _todayTasks(taches);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          icon: Icons.work_outline,
          title: 'Mon stage',
        ),
        if (internship == null)
          const _SectionHint(
            icon: Icons.work_off_outlined,
            message: 'Aucun stage trouvé. Les informations apparaîtront une fois votre stage validé.',
          )
        else ...[
          InternshipCard(
            internship: internship,
            onTap: () => context.push(RoutePaths.completion),
          ),
          const SizedBox(height: 14),
          _ProgressCard(internship: internship),
        ],
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.checklist_outlined,
          title: 'Mes tâches',
          count: tachesRestantes,
          onSeeAll: () => context.go(RoutePaths.mesTaches),
        ),
        if (todayTasks.isEmpty)
          const _SectionHint(icon: Icons.checklist_outlined, message: 'Aucune tâche en cours.')
        else
          for (final tache in todayTasks)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TacheCard(tache: tache),
            ),
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.event_outlined,
          title: 'Mes réunions',
          count: todayMeetings.length,
          onSeeAll: () => context.push(RoutePaths.mesReunions),
        ),
        if (todayMeetings.isEmpty)
          const _SectionHint(icon: Icons.event_available_outlined, message: 'Aucune réunion aujourd\'hui.')
        else
          for (final reunion in todayMeetings.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ReunionCard(reunion: reunion),
            ),
      ],
    );
  }

  Widget _buildSidebar(
    BuildContext context,
    WidgetRef ref, {
    required DashboardStats stats,
    required Internship? internship,
    required List<Tache> taches,
    required List<AppNotification> notifications,
    required SupervisorInfo? supervisor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          icon: Icons.description_outlined,
          title: 'Mes documents',
          count: stats.recentDocuments.length,
          onSeeAll: () => context.push(RoutePaths.mesDocuments),
        ),
        if (stats.recentDocuments.isEmpty)
          const _SectionHint(icon: Icons.upload_file_outlined, message: 'Aucun document déposé pour le moment.')
        else
          for (final document in stats.recentDocuments.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DocumentCard(document: document),
            ),
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.notifications_outlined,
          title: 'Mes notifications',
          count: notifications.length,
          onSeeAll: () => context.go(RoutePaths.mesNotifications),
        ),
        if (notifications.isEmpty)
          const _SectionHint(icon: Icons.notifications_off_outlined, message: 'Aucune notification.')
        else
          for (final notification in notifications.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: NotificationCard(
                notification: notification,
                onTap: notification.lue
                    ? null
                    : () => ref
                        .read(myNotificationsProvider.notifier)
                        .markAsRead(notification.id),
              ),
            ),
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.hourglass_top_outlined,
          title: 'Prochaines échéances',
          onSeeAll: () => context.go(RoutePaths.mesTaches),
        ),
        _DeadlinesCard(taches: taches),
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.support_agent_outlined,
          title: 'Encadrement',
        ),
        _buildSupervisorCard(context, supervisor, internship),
        if (stats.departmentFor(internship?.departementNom) != null ||
            internship != null) ...[
          const SizedBox(height: 12),
          _buildDepartmentCard(context, stats, internship),
        ],
        const SizedBox(height: 12),
        SectionHeader(
          icon: Icons.history_outlined,
          title: 'Activité récente',
        ),
        _buildActivitySection(
          context,
          notifications: notifications,
          taches: taches,
          reunions: stats.prochainesReunions,
          documents: stats.recentDocuments,
          visibleTaskTitles: _todayTasks(taches).map((t) => t.titre).toSet(),
        ),
      ],
    );
  }

  Widget _buildSupervisorCard(
    BuildContext context,
    SupervisorInfo? supervisor,
    Internship? internship,
  ) {
    if (supervisor != null) {
      return SupervisorCard(supervisor: supervisor);
    }
    final name = internship?.encadrantFullName ?? '';
    return AppCard(
      child: AppCardHeader(
        icon: Icons.person_outline,
        color: AppColors.textSecondary,
        title: name.isEmpty ? 'En attente d\'affectation' : name,
        subtitle: 'Votre encadrant',
      ),
    );
  }

  Widget _buildDepartmentCard(
    BuildContext context,
    DashboardStats stats,
    Internship? internship,
  ) {
    final dept = stats.departmentFor(internship?.departementNom);
    final name = internship?.departementNom ?? '';
    return DepartmentCard(
      name: name,
      nbEncadrants: dept?.nbEncadrants,
      nbStagesActifs: dept?.nbStagesActifs,
    );
  }

  Widget _buildActivitySection(
    BuildContext context, {
    required List<AppNotification> notifications,
    required List<Tache> taches,
    required List<Reunion> reunions,
    required List<DocumentItem> documents,
    required Set<String> visibleTaskTitles,
  }) {
    final entries = <ActivityEntry>[];

    if (notifications.isNotEmpty) {
      final notification = notifications.first;
      entries.add(
        ActivityEntry(
          icon: NotificationCard.icon(notification.type),
          color: NotificationCard.color(notification.type),
          title: notification.titre.isEmpty ? 'Notification' : notification.titre,
          subtitle: notification.message.isEmpty
              ? NotificationCard.label(notification.type)
              : notification.message,
          timeLabel: formatRelativeDayFr(notification.date),
          onTap: () => context.go(RoutePaths.mesNotifications),
        ),
      );
    }

    if (taches.isNotEmpty) {
      final tache = taches
          .where((t) => !visibleTaskTitles.contains(t.titre))
          .firstOrNull;
      if (tache != null) {
        entries.add(
          ActivityEntry(
            icon: Icons.checklist_outlined,
            color: AppColors.info,
            title: tache.titre,
            subtitle: TacheStatut.fromValue(tache.statut)?.label ?? tache.statut,
            timeLabel: formatRelativeDayFr(tache.dateFin ?? tache.createdAt),
            onTap: () => context.go(RoutePaths.mesTaches),
          ),
        );
      }
    }

    if (reunions.isNotEmpty) {
      final reunion = reunions.first;
      final supervisor = reunion.encadrantFullName;
      entries.add(
        ActivityEntry(
          icon: Icons.event_outlined,
          color: AppColors.success,
          title: reunion.sujet.isEmpty ? 'Réunion' : reunion.sujet,
          subtitle: supervisor.isEmpty
              ? reunion.heureLabel
              : '${reunion.heureLabel} · $supervisor',
          timeLabel: formatRelativeDayFr(reunion.date),
          onTap: () => context.push(RoutePaths.mesReunions),
        ),
      );
    }

    if (documents.isNotEmpty) {
      final document = documents.first;
      entries.add(
        ActivityEntry(
          icon: Icons.description_outlined,
          color: AppColors.purple,
          title: document.nom.isEmpty ? 'Document' : document.nom,
          subtitle: document.typeLabel,
          timeLabel: formatRelativeDayFr(document.dateDepot),
          onTap: () => context.push(RoutePaths.mesDocuments),
        ),
      );
    }

    if (entries.isEmpty) {
      return const _SectionHint(
        icon: Icons.hourglass_empty,
        message: 'Aucune activité récente pour le moment.',
      );
    }

    return ActivityTimeline(entries: entries.take(4).toList());
  }

  List<Tache> _todayTasks(List<Tache> taches) {
    final active = taches
        .where((t) => t.statut != 'TERMINEE')
        .toList();
    active.sort((a, b) {
      final retard = (b.estEnRetard ? 1 : 0) - (a.estEnRetard ? 1 : 0);
      if (retard != 0) return retard;
      return _prioriteRank(a.priorite).compareTo(_prioriteRank(b.priorite));
    });
    return active.take(3).toList();
  }

  static int _prioriteRank(String priorite) => switch (priorite) {
        'URGENTE' => 0,
        'HAUTE' => 1,
        'MOYENNE' => 2,
        _ => 3,
      };

  static int? _joursRestants(Internship? internship) {
    final end = internship?.dateFin;
    if (end == null) return null;
    return dateOnly(end).difference(dateOnly(DateTime.now())).inDays;
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.user,
    required this.internship,
    required this.unread,
    required this.tachesRestantes,
    required this.joursRestants,
    required this.todayMeetings,
  });

  final User user;
  final Internship? internship;
  final int unread;
  final int tachesRestantes;
  final int? joursRestants;
  final int todayMeetings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final prenom = user.prenom.isEmpty ? (user.nom.isEmpty ? '' : user.nom) : user.prenom;
    final departement = internship?.departementNom ?? '';

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 96,
            width: double.infinity,
            decoration: const BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppTheme.radiusLg),
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -24,
                  top: -40,
                  child: _DecorativeCircle(size: 140, opacity: 0.1),
                ),
                Positioned(
                  right: 70,
                  bottom: -46,
                  child: _DecorativeCircle(size: 110, opacity: 0.08),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
            child: Transform.translate(
              offset: const Offset(0, -32),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    width: 66,
                    height: 66,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: theme.colorScheme.surface,
                        width: 3,
                      ),
                      boxShadow: AppColors.softShadowSmall,
                    ),
                    child: AppAvatar(
                      name: '${user.prenom} ${user.nom}',
                      size: 60,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          prenom.isEmpty ? 'Bonjour' : 'Bonjour, $prenom',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Stagiaire${departement.isNotEmpty ? ' · $departement' : ''}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _formatLongDateFr(DateTime.now()),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HeroPill(
                  icon: Icons.hourglass_top_outlined,
                  label: joursRestants == null
                      ? 'Stage non défini'
                      : '$joursRestants ${joursRestants == 1 ? 'jour' : 'jours'} restants',
                  color: AppColors.violet,
                ),
                _HeroPill(
                  icon: Icons.checklist_outlined,
                  label: '$tachesRestantes ${tachesRestantes > 1 ? 'tâches' : 'tâche'} en cours',
                  color: AppColors.info,
                ),
                if (todayMeetings > 0)
                  _HeroPill(
                    icon: Icons.event_available_outlined,
                    label: '$todayMeetings ${todayMeetings > 1 ? 'réunions' : 'réunion'} aujourd\'hui',
                    color: AppColors.success,
                  ),
                if (unread > 0)
                  _HeroPill(
                    icon: Icons.notifications_active_outlined,
                    label: '$unread non ${unread > 1 ? 'lues' : 'lue'}',
                    color: AppColors.warning,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _formatLongDateFr(DateTime date) {
    const weekdays = [
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
      'dimanche',
    ];
    const months = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];
    return '${weekdays[date.weekday - 1]} ${date.day} ${months[date.month - 1]} ${date.year}';
  }
}

class _DecorativeCircle extends StatelessWidget {
  const _DecorativeCircle({required this.size, required this.opacity});

  final double size;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: opacity),
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.internship});

  final Internship internship;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = internship.progress;
    final color = internship.isActive ? AppColors.primary : AppColors.success;
    final joursRestants =
        dateOnly(internship.dateFin ?? DateTime(2100))
            .difference(dateOnly(DateTime.now()))
            .inDays;

    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          SizedBox(
            width: 68,
            height: 68,
            child: Stack(
              fit: StackFit.expand,
              children: [
                AnimatedCircularProgress(
                  value: progress / 100,
                  strokeWidth: 7,
                  backgroundColor:
                      Theme.of(context).colorScheme.surfaceContainerHighest,
                  color: color,
                ),
                Center(
                  child: AnimatedCounter(
                    value: progress,
                    suffix: '%',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Progression du stage',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  internship.periodeLabel,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  joursRestants >= 0
                      ? '$joursRestants ${joursRestants == 1 ? 'jour' : 'jours'} restants'
                      : 'Stage terminé',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: color,
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

class _DeadlinesCard extends StatelessWidget {
  const _DeadlinesCard({required this.taches});

  final List<Tache> taches;

  @override
  Widget build(BuildContext context) {
    final today = dateOnly(DateTime.now());
    final deadlines = taches
        .where((t) => t.statut != 'TERMINEE' && t.dateFin != null)
        .where((t) => !dateOnly(t.dateFin!).isBefore(today))
        .toList()
      ..sort((a, b) => a.dateFin!.compareTo(b.dateFin!));

    if (deadlines.isEmpty) {
      return const _SectionHint(
        icon: Icons.hourglass_empty,
        message: 'Aucune échéance à venir.',
      );
    }

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Column(
        children: [
          for (var i = 0; i < deadlines.take(4).length; i++)
            if (i > 0) const Divider(height: 1),
          for (final tache in deadlines.take(4))
            _DeadlineTile(tache: tache),
        ],
      ),
    );
  }
}

class _DeadlineTile extends StatelessWidget {
  const _DeadlineTile({required this.tache});

  final Tache tache;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enRetard = tache.estEnRetard;
    final color = enRetard ? AppColors.danger : AppColors.warning;
    final fin = tache.dateFin;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              enRetard ? Icons.warning_amber_rounded : Icons.event_outlined,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tache.titre,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fin == null
                      ? 'Sans échéance'
                      : 'Échéance : ${formatDateFr(fin)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            enRetard ? 'En retard' : formatRelativeDayFr(fin),
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({
    required this.stats,
    required this.unread,
    required this.onTapTasks,
    required this.onTapMeetings,
    required this.onTapNotifications,
  });

  final DashboardStats stats;
  final int unread;
  final VoidCallback onTapTasks;
  final VoidCallback onTapMeetings;
  final VoidCallback onTapNotifications;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      StatTile(
        icon: Icons.pending_actions_outlined,
        value: '${stats.tachesAFaire}',
        label: 'Tâches à faire',
        color: AppColors.warning,
        onTap: onTapTasks,
      ),
      StatTile(
        icon: Icons.play_circle_outline,
        value: '${stats.tachesEnCours}',
        label: 'Tâches en cours',
        color: AppColors.info,
        onTap: onTapTasks,
      ),
      StatTile(
        icon: Icons.event_available_outlined,
        value: '${stats.prochainesReunions.length}',
        label: 'Réunions à venir',
        color: AppColors.success,
        onTap: onTapMeetings,
      ),
      StatTile(
        icon: Icons.notifications_active_outlined,
        value: '$unread',
        label: 'Notifications non lues',
        color: AppColors.primary,
        onTap: onTapNotifications,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.35,
      ),
      itemCount: tiles.length,
      itemBuilder: (context, index) => tiles[index],
    );
  }
}

class _SectionHint extends StatelessWidget {
  const _SectionHint({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: AppColors.softShadowSmall,
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.textSecondary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
