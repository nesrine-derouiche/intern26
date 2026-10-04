import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/app_card.dart';
import '../common/app_fade_in.dart';

/// Data model for one entry of the recent-activity timeline.
class ActivityEntry {
  const ActivityEntry({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.timeLabel,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String timeLabel;
  final VoidCallback? onTap;
}

/// Timeline row — gradient icon, vertical connector and content.
class ActivityTile extends StatelessWidget {
  const ActivityTile({
    super.key,
    required this.entry,
    this.showConnector = true,
  });

  final ActivityEntry entry;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: entry.onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 34,
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: entry.color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(entry.icon, size: 17, color: entry.color),
                ),
                if (showConnector) ...[
                  const SizedBox(height: 6),
                  Container(
                    width: 2,
                    height: 26,
                    color: AppColors.border,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  entry.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            entry.timeLabel,
            style: theme.textTheme.labelSmall?.copyWith(
              color: AppColors.textTertiary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// Stacks [ActivityEntry]s as a connected timeline with a stagger animation.
class ActivityTimeline extends StatelessWidget {
  const ActivityTimeline({super.key, required this.entries});

  final List<ActivityEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          AppFadeIn(
            delay: Duration(milliseconds: 120 + i * 80),
            offset: const Offset(0, 12),
            child: Padding(
              padding: EdgeInsets.only(bottom: i == entries.length - 1 ? 0 : 12),
              child: ActivityTile(
                entry: entries[i],
                showConnector: i != entries.length - 1,
              ),
            ),
          ),
      ],
    );
  }
}
