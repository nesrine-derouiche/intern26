import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/app_card.dart';
import '../common/app_fade_in.dart';
import 'responsive_grid.dart';

/// Premium KPI card — gradient icon tile, animated count-up value.
class StatCard extends StatelessWidget {
  const StatCard({
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
    final numeric = int.tryParse(value);
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 19, color: color),
              ),
              if (onTap != null)
                Icon(
                  Icons.arrow_outward,
                  size: 15,
                  color: AppColors.textTertiary,
                ),
            ],
          ),
          const Spacer(),
          if (numeric != null)
            TweenAnimationBuilder<int>(
              tween: IntTween(begin: 0, end: numeric),
              duration: const Duration(milliseconds: 650),
              curve: Curves.easeOutCubic,
              builder: (context, value, _) => Text(
                '$value',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
            )
          else
            Text(
              value,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
          const SizedBox(height: 2),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Responsive grid of [StatCard]s with a staggered entrance animation.
class StatCardsGrid extends StatelessWidget {
  const StatCardsGrid({super.key, required this.cards});

  final List<StatCard> cards;

  @override
  Widget build(BuildContext context) {
    return ResponsiveGrid(
      itemCount: cards.length,
      maxCrossAxisExtent: 200,
      childAspectRatio: 1.3,
      itemBuilder: (context, index) => AppFadeIn(
        delay: Duration(milliseconds: 90 + index * 70),
        offset: const Offset(0, 10),
        child: cards[index],
      ),
    );
  }
}
