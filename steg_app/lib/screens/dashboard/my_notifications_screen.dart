import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/app_notification.dart';
import '../../models/notification_category.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/dashboard/dashboard_skeletons.dart';
import '../../widgets/dashboard/notification_card.dart';

class MyNotificationsScreen extends ConsumerWidget {
  const MyNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(myNotificationsProvider);
    final unread = ref.watch(unreadNotificationsProvider);
    final total = notificationsAsync.value?.length ?? 0;
    final notifier = ref.read(myNotificationsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Centre de notifications'),
        actions: [
          if (unread > 0)
            TextButton.icon(
              onPressed: notifier.markAllAsRead,
              icon: const Icon(Icons.done_all, size: 18),
              label: const Text('Tout marquer lu'),
            ),
        ],
      ),
      body: _buildBody(
        context,
        ref,
        notificationsAsync,
        unread: unread,
        total: total,
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<AppNotification>> notificationsAsync, {
    required int unread,
    required int total,
  }) {
    if (notificationsAsync.isLoading && !notificationsAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 6,
        itemBuilder: (context, index) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: NotificationCardSkeleton(),
        ),
      );
    }

    if (notificationsAsync.hasError && !notificationsAsync.hasValue) {
      return ErrorView(
        message: notificationsAsync.error.toString(),
        onRetry: () => ref.refresh(myNotificationsProvider.future),
      );
    }

    final notifications = notificationsAsync.value ?? const <AppNotification>[];
    final selected = ref.watch(notificationTypeFilterProvider);
    final filtered = selected == null
        ? notifications
        : notifications
            .where((notification) => notification.category == selected)
            .toList();

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myNotificationsProvider.future),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _SummaryHeader(
              unread: unread,
              total: total,
              onMarkAll: unread > 0
                  ? () => ref
                      .read(myNotificationsProvider.notifier)
                      .markAllAsRead()
                  : null,
            ),
          ),
          if (notifications.isNotEmpty)
            SliverToBoxAdapter(
              child: _CategoryFilter(
                notifications: notifications,
                selected: selected,
                onSelected: (category) => ref
                    .read(notificationTypeFilterProvider.notifier)
                    .select(category),
              ),
            ),
          if (filtered.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: selected == null
                  ? const EmptyState(
                      icon: Icons.notifications_off_outlined,
                      title: 'Aucune notification',
                      message: 'Vous serez informé des nouveautés de votre stage ici.',
                    )
                  : EmptyState(
                      icon: Icons.filter_alt_off_outlined,
                      title: 'Aucune dans cette catégorie',
                      message:
                          'Aucune notification ${selected.label.toLowerCase()} pour le moment.',
                    ),
            )
          else
            ..._buildSections(
              context,
              ref,
              filtered,
              markAsRead: (id) =>
                  ref.read(myNotificationsProvider.notifier).markAsRead(id),
              delete: (id) =>
                  ref.read(myNotificationsProvider.notifier).delete(id),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildSections(
    BuildContext context,
    WidgetRef ref,
    List<AppNotification> notifications, {
    required ValueChanged<String> markAsRead,
    required ValueChanged<String> delete,
  }) {
    final groups = <(String, List<AppNotification>)>[];
    for (final notification in notifications) {
      final label = _sectionLabel(notification.date);
      if (groups.isEmpty || groups.last.$1 != label) {
        groups.add((label, [notification]));
      } else {
        groups.last.$2.add(notification);
      }
    }

    return [
      for (final (label, items) in groups) ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Text(
              label,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                  ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final notification = items[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Dismissible(
                    key: ValueKey(notification.id),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) => _confirmDelete(context),
                    onDismissed: (_) => delete(notification.id),
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      decoration: BoxDecoration(
                        color: AppColors.danger,
                        borderRadius: BorderRadius.circular(AppTheme.radius),
                      ),
                      child: const Icon(Icons.delete_outline,
                          color: Colors.white),
                    ),
                    child: NotificationCard(
                      notification: notification,
                      onTap: () {
                        if (!notification.lue) markAsRead(notification.id);
                        _showDetails(context, notification);
                      },
                    ),
                  ),
                );
              },
              childCount: items.length,
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 8)),
      ],
    ];
  }

  String _sectionLabel(DateTime? date) {
    if (date == null) return 'Plus tôt';
    final today = dateOnly(DateTime.now());
    final target = dateOnly(date);
    final diff = today.difference(target).inDays;
    if (diff <= 0) return "Aujourd'hui";
    if (diff == 1) return 'Hier';
    final weekStart = startOfWeek(today);
    if (!target.isBefore(weekStart)) return 'Cette semaine';
    return formatDateFr(date);
  }

  Future<bool> _confirmDelete(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer la notification ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  void _showDetails(BuildContext context, AppNotification notification) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: NotificationCard.color(notification.type)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    NotificationCard.icon(notification.type),
                    size: 20,
                    color: NotificationCard.color(notification.type),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        NotificationCard.label(notification.type),
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
                            ?.copyWith(
                              color: NotificationCard.color(notification.type),
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      Text(
                        formatRelativeDayFr(notification.date),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.textSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              notification.titre,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              notification.message,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryHeader extends StatelessWidget {
  const _SummaryHeader({
    required this.unread,
    required this.total,
    required this.onMarkAll,
  });

  final int unread;
  final int total;
  final VoidCallback? onMarkAll;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.notifications_active_outlined,
                color: Colors.white, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Notifications',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  unread == 0
                      ? (total == 0 ? 'Aucune notification' : '$total notification${total > 1 ? 's' : ''}')
                      : '$unread non lue${unread > 1 ? 's' : ''} · $total au total',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ],
            ),
          ),
          if (onMarkAll != null) ...[
            const SizedBox(width: 8),
            IconButton(
              tooltip: 'Tout marquer lu',
              onPressed: onMarkAll,
              icon: const Icon(Icons.done_all, color: Colors.white),
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryFilter extends StatelessWidget {
  const _CategoryFilter({
    required this.notifications,
    required this.selected,
    required this.onSelected,
  });

  final List<AppNotification> notifications;
  final NotificationCategory? selected;
  final ValueChanged<NotificationCategory?> onSelected;

  int _unreadIn(NotificationCategory? category) {
    if (category == null) return notifications.where((n) => !n.lue).length;
    return notifications
        .where((n) => n.category == category && !n.lue)
        .length;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        children: [
          _FilterChip(
            label: 'Toutes',
            count: _unreadIn(null),
            selected: selected == null,
            onSelected: () => onSelected(null),
          ),
          for (final category in NotificationCategory.values)
            _FilterChip(
              label: category.label,
              count: _unreadIn(category),
              selected: selected == category,
              onSelected: () => onSelected(category),
            ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.25)
                      : theme.colorScheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: selected
                        ? Colors.white
                        : theme.colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
        selected: selected,
        onSelected: (_) => onSelected(),
      ),
    );
  }
}
