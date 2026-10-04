import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/app_notification.dart';
import '../../models/notification_category.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';

class NotificationCard extends StatelessWidget {
  const NotificationCard({
    super.key,
    required this.notification,
    this.onTap,
  });

  final AppNotification notification;
  final VoidCallback? onTap;

  static IconData icon(String type) {
    return switch (type) {
      'TACHE' => Icons.checklist_outlined,
      'CANDIDATURE' => Icons.fact_check_outlined,
      'STAGE' => Icons.work_outline,
      'REUNION' => Icons.event_outlined,
      'DOCUMENT' => Icons.description_outlined,
      'EVALUATION' => Icons.grading_outlined,
      'JOURNAL' => Icons.menu_book_outlined,
      'INFO' => Icons.info_outline,
      _ => Icons.notifications_outlined,
    };
  }

  static Color color(String type) {
    return switch (type) {
      'TACHE' => AppColors.info,
      'CANDIDATURE' => AppColors.warning,
      'STAGE' => AppColors.purple,
      'REUNION' => AppColors.success,
      'DOCUMENT' => AppColors.purple,
      'EVALUATION' => AppColors.teal,
      'JOURNAL' => AppColors.primary,
      'INFO' => AppColors.textSecondary,
      _ => AppColors.primary,
    };
  }

  static String label(String type) => NotificationCategory.fromValue(type).label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = !notification.lue;
    final categoryColor = color(notification.type);

    return AppCard(
      color: unread
          ? categoryColor.withValues(alpha: 0.05)
          : theme.colorScheme.surface,
      padding: const EdgeInsets.all(14),
      shadow: !unread,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: icon(notification.type),
            color: unread ? categoryColor : AppColors.textSecondary,
            title: notification.titre,
            subtitle: notification.message,
            badge: unread ? const _UnreadDot() : null,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                Icons.schedule,
                size: 13,
                color: AppColors.textSecondary.withValues(alpha: 0.8),
              ),
              const SizedBox(width: 4),
              Text(
                formatRelativeDayFr(notification.date),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Text(
                  label(notification.type),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: categoryColor,
                    fontSize: 11,
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

class _UnreadDot extends StatelessWidget {
  const _UnreadDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      margin: const EdgeInsets.only(top: 6),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
    );
  }
}
