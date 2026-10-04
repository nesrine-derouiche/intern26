import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../common/app_fade_in.dart';
import 'responsive_grid.dart';

/// Data model describing a quick action tile.
class QuickActionItem {
  const QuickActionItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = AppColors.primary,
    this.dot = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final bool dot;
}

/// Compact, tappable tile with a clear icon and an optional unread dot.
class QuickActionTile extends StatefulWidget {
  const QuickActionTile({super.key, required this.item});

  final QuickActionItem item;

  @override
  State<QuickActionTile> createState() => _QuickActionTileState();
}

class _QuickActionTileState extends State<QuickActionTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final item = widget.item;
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 140;
        final iconSize = compact ? 40.0 : 46.0;
        return Semantics(
          button: true,
          label: item.label,
          child: Tooltip(
            message: item.label,
            child: AnimatedScale(
              scale: _pressed ? 0.96 : 1,
              duration: const Duration(milliseconds: 120),
              curve: Curves.easeOut,
              child: GestureDetector(
                onTapDown: (_) => setState(() => _pressed = true),
                onTapCancel: () => setState(() => _pressed = false),
                onTapUp: (_) => setState(() => _pressed = false),
                onTap: item.onTap,
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: compact ? 5 : 8,
                    vertical: compact ? 10 : 14,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                    border: Border.all(color: theme.colorScheme.outlineVariant),
                    boxShadow: AppColors.softShadowSmall,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: iconSize,
                            height: iconSize,
                            decoration: BoxDecoration(
                              color: item.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(15),
                            ),
                            child: Icon(
                              item.icon,
                              size: compact ? 20 : 22,
                              color: item.color,
                            ),
                          ),
                          if (item.dot)
                            Positioned(
                              right: -2,
                              top: -2,
                              child: Container(
                                width: 11,
                                height: 11,
                                decoration: BoxDecoration(
                                  color: AppColors.danger,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: theme.colorScheme.surface,
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      SizedBox(height: compact ? 7 : 10),
                      Text(
                        item.label,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          height: 1.15,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Responsive grid of [QuickActionTile]s with a staggered entrance.
class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({
    super.key,
    required this.items,
    this.maxCrossAxisExtent = 160,
  });

  final List<QuickActionItem> items;
  final double maxCrossAxisExtent;

  @override
  Widget build(BuildContext context) {
    return ResponsiveGrid(
      itemCount: items.length,
      maxCrossAxisExtent: maxCrossAxisExtent,
      childAspectRatio: 0.98,
      itemBuilder: (context, index) => AppFadeIn(
        delay: Duration(milliseconds: 100 + index * 60),
        offset: const Offset(0, 10),
        child: QuickActionTile(item: items[index]),
      ),
    );
  }
}
