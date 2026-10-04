import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/animated_progress.dart';
import '../common/app_card.dart';

class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.color = AppColors.primary,
    this.onTap,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 20, color: color),
              ),
              if (onTap != null)
                Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: AppColors.textSecondary.withValues(alpha: 0.6),
                ),
            ],
          ),
          const SizedBox(height: 14),
          _valueText(theme),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _valueText(ThemeData theme) {
    final numeric = int.tryParse(value);
    final style = theme.textTheme.headlineSmall?.copyWith(
      fontWeight: FontWeight.w800,
    );
    if (numeric == null) {
      return Text(value, style: style);
    }
    return AnimatedCounter(value: numeric, style: style);
  }
}
