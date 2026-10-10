import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/app_notification.dart';
import '../../models/document_item.dart';
import '../../models/stagiaire_overview.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../providers/push/push_provider.dart';
import '../../providers/stagiaire/stagiaire_overview_provider.dart';
import '../../widgets/common/app_fade_in.dart';
import '../../widgets/common/app_section_header.dart';
import '../../widgets/dashboard/notification_card.dart';
import '../../widgets/home/activity_tile.dart';
import '../../widgets/home/home_hero.dart';
import '../../widgets/home/quick_action.dart';
import '../../widgets/home/stat_card.dart';
import 'home_stagiaire_view.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(pushControllerProvider.notifier).initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value?.session?.user;
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    final isStagiaire = user?.role == 'STAGIAIRE';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Accueil'),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go(RoutePaths.mesNotifications),
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_outlined),
                if (unread > 0)
                  Positioned(
                    right: -2,
                    top: -3,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: const BoxDecoration(
                        color: AppColors.danger,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: isStagiaire ? _buildStagiaireBody() : _buildOtherBody(unread),
    );
  }

  Widget _buildStagiaireBody() {
    final overviewAsync = ref.watch(stagiaireOverviewProvider);
    return HomeStagiaireView(
      overviewAsync: overviewAsync,
      onRefresh: () async {
        await ref.read(stagiaireOverviewProvider.notifier).build();
      },
    );
  }

  Widget _buildOtherBody(int unread) {
    final user = ref.watch(authProvider).value?.session?.user;
    final isStagiaire = user?.role == 'STAGIAIRE';

    final overviewAsync = isStagiaire ? ref.watch(stagiaireOverviewProvider) : null;
    final overview = overviewAsync?.value;
    final internship = overview?.asInternship;

    final documents = isStagiaire
        ? ref.watch(myDocumentsProvider).value ?? const <DocumentItem>[]
        : const <DocumentItem>[];
    final notifications =
        ref.watch(myNotificationsProvider).value ?? const <AppNotification>[];

    final quickItems = _buildQuickActions(unread: unread);
    final spaceItems = _buildSpaceItems();
    final activityEntries = _buildActivity(
      isStagiaire: isStagiaire,
      notifications: notifications,
      overview: overview,
      documents: documents,
    );

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          ref.refresh(dashboardStatsProvider.future),
          ref.refresh(myNotificationsProvider.future),
        ]);
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppFadeIn(
              child: HomeHero(
                user: user,
                internship: internship,
                department: internship?.departementNom,
              ),
            ),
            const SizedBox(height: 24),
            const AppFadeIn(
              delay: Duration(milliseconds: 80),
              child: AppSectionHeader(
                icon: Icons.bolt_outlined,
                title: 'Actions rapides',
              ),
            ),
            const SizedBox(height: 12),
            QuickActionsGrid(items: quickItems),
            const SizedBox(height: 24),
            AppFadeIn(
              delay: const Duration(milliseconds: 120),
              child: const AppSectionHeader(
                icon: Icons.insights_outlined,
                title: 'En un coup d\'œil',
              ),
            ),
            const SizedBox(height: 12),
            StatCardsGrid(
              cards: [
                StatCard(
                  icon: Icons.notifications_outlined,
                  value: '$unread',
                  label: 'Notifications non lues',
                  color: AppColors.warning,
                  onTap: () => context.go(RoutePaths.mesNotifications),
                ),
              ],
            ),
            if (spaceItems.isNotEmpty) ...[
              const SizedBox(height: 24),
              AppFadeIn(
                delay: const Duration(milliseconds: 140),
                child: const AppSectionHeader(
                  icon: Icons.apps_outlined,
                  title: 'Votre espace',
                ),
              ),
              const SizedBox(height: 12),
              QuickActionsGrid(items: spaceItems, maxCrossAxisExtent: 190),
            ],
            const SizedBox(height: 24),
            AppFadeIn(
              delay: const Duration(milliseconds: 160),
              child: const AppSectionHeader(
                icon: Icons.history_outlined,
                title: 'Activité récente',
              ),
            ),
            const SizedBox(height: 12),
            if (activityEntries.isEmpty)
              AppFadeIn(
                delay: const Duration(milliseconds: 180),
                child: _EmptyActivity(),
              )
            else
              ActivityTimeline(entries: activityEntries),
          ],
        ),
      ),
    );
  }

  List<QuickActionItem> _buildQuickActions({required int unread}) {
    final user = ref.watch(authProvider).value?.session?.user;
    final isStagiaire = user?.role == 'STAGIAIRE';
    return [
      QuickActionItem(
        icon: Icons.work_outline,
        label: 'Offres de stage',
        color: AppColors.primary,
        onTap: () => context.push(RoutePaths.offres),
      ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.calendar_month_outlined,
          label: 'Calendrier',
          color: AppColors.violet,
          onTap: () => context.go(RoutePaths.calendrier),
        ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.description_outlined,
          label: 'Documents',
          color: AppColors.info,
          onTap: () => context.push(RoutePaths.mesDocuments),
        ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.checklist_outlined,
          label: 'Tâches',
          color: AppColors.success,
          onTap: () => context.go(RoutePaths.mesTaches),
        ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.note_alt_outlined,
          label: 'Notes',
          color: AppColors.violet,
          onTap: () => context.push(RoutePaths.notes),
        ),
      QuickActionItem(
        icon: Icons.notifications_outlined,
        label: 'Notifications',
        color: AppColors.warning,
        dot: unread > 0,
        onTap: () => context.go(RoutePaths.mesNotifications),
      ),
    ];
  }

  List<QuickActionItem> _buildSpaceItems() {
    final user = ref.watch(authProvider).value?.session?.user;
    final role = user?.role ?? '';
    final isStagiaire = role == 'STAGIAIRE';
    final isEncadrant = role == 'ENCADRANT' || role == 'CHEF_DEPARTEMENT';

    return [
      QuickActionItem(
        icon: Icons.person_outline,
        label: 'Mon profil',
        color: AppColors.primary,
        onTap: () => context.go(RoutePaths.profile),
      ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.dashboard_customize_outlined,
          label: 'Tableau de bord',
          color: AppColors.teal,
          onTap: () => context.push(RoutePaths.internDashboard),
        ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.fact_check_outlined,
          label: 'Mes candidatures',
          color: AppColors.warning,
          onTap: () => context.push(RoutePaths.mesCandidatures),
        ),
      if (isStagiaire)
        QuickActionItem(
          icon: Icons.menu_book_outlined,
          label: 'Journal hebdomadaire',
          color: AppColors.violet,
          onTap: () => context.push(RoutePaths.journal),
        ),
      if (isEncadrant)
        QuickActionItem(
          icon: Icons.menu_book_outlined,
          label: 'Journaux hebdomadaires',
          color: AppColors.violet,
          onTap: () => context.push(RoutePaths.journal),
        ),
    ];
  }

  List<ActivityEntry> _buildActivity({
    required bool isStagiaire,
    required List<AppNotification> notifications,
    StagiaireOverview? overview,
    required List<DocumentItem> documents,
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

    if (!isStagiaire) return entries;

    final nextTasks = overview?.tasks.next ?? [];
    if (nextTasks.isNotEmpty) {
      final task = nextTasks.first;
      entries.add(
        ActivityEntry(
          icon: Icons.checklist_outlined,
          color: AppColors.info,
          title: task.titre,
          subtitle: task.priorite,
          timeLabel: task.dateFin != null ? formatRelativeDayFr(task.dateFin!) : '',
          onTap: () => context.go(RoutePaths.mesTaches),
        ),
      );
    }

    final meetings = overview?.upcomingMeetings ?? [];
    if (meetings.isNotEmpty) {
      final meeting = meetings.first;
      entries.add(
        ActivityEntry(
          icon: Icons.event_outlined,
          color: AppColors.success,
          title: meeting.sujet.isEmpty ? 'Reunion' : meeting.sujet,
          subtitle: meeting.heureLabel,
          timeLabel: meeting.date != null ? formatRelativeDayFr(meeting.date!) : '',
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

    return entries;
  }
}

class _EmptyActivity extends StatelessWidget {
  const _EmptyActivity();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.softShadowSmall,
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.textSecondary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.hourglass_empty,
              size: 20,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Aucune activité récente',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Vos dernières notifications, tâches, réunions et documents '
                  'apparaîtront ici.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
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
