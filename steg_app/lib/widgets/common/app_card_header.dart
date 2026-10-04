import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'animated_progress.dart';

/// Standardized card header — icon in a colored circle, title, optional
/// subtitle, optional badge/trailing widget and optional progress bar.
class AppCardHeader extends StatelessWidget {
  const AppCardHeader({
    super.key,
    this.leading,
    required this.icon,
    required this.title,
    this.color = AppColors.primary,
    this.subtitle,
    this.badge,
    this.trailing,
    this.progress,
    this.progressLabel,
    this.progressColor,
    this.circleSize = 46,
    this.iconSize = 22,
    this.titleMaxLines = 2,
    this.heroTag,
  });

  /// Optional widget shown in place of the colored icon circle
  /// (e.g. an initials avatar).
  final Widget? leading;
  final IconData icon;
  final String title;
  final Color color;
  final String? subtitle;
  final Widget? badge;
  final Widget? trailing;
  final double? progress;
  final String? progressLabel;
  final Color? progressColor;
  final double circleSize;
  final double iconSize;
  final int titleMaxLines;

  /// When provided, the title is wrapped in a [Hero] with this tag so it can
  /// fly into a matching tag on a pushed detail screen.
  final String? heroTag;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        leading ??
            Container(
              width: circleSize,
              height: circleSize,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: iconSize, color: color),
            ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: heroTag == null
                        ? _buildTitle(theme)
                        : Hero(
                            tag: heroTag!,
                            child: Material(
                              color: Colors.transparent,
                              child: _buildTitle(theme),
                            ),
                          ),
                  ),
                  if (badge != null || trailing != null) ...[
                    const SizedBox(width: 8),
                    badge ?? trailing!,
                  ],
                ],
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              if (progress != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: AnimatedLinearProgress(
                        value: progress!,
                        color: progressColor ?? color,
                      ),
                    ),
                    if (progressLabel != null) ...[
                      const SizedBox(width: 10),
                      Text(
                        progressLabel!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTitle(ThemeData theme) {
    return Text(
      title,
      maxLines: titleMaxLines,
      overflow: TextOverflow.ellipsis,
      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}
