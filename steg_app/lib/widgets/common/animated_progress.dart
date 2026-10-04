import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Progress bar that smoothly animates from 0 to [value] on first build and
/// whenever the target changes.
class AnimatedLinearProgress extends StatelessWidget {
  const AnimatedLinearProgress({
    super.key,
    required this.value,
    this.color,
    this.backgroundColor = AppColors.border,
    this.minHeight = 8,
  });

  final double value;
  final Color? color;
  final Color backgroundColor;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0.0, 1.0).toDouble()),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, animatedValue, _) => ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        child: LinearProgressIndicator(
          value: animatedValue,
          minHeight: minHeight,
          backgroundColor: backgroundColor,
          color: color ?? theme.colorScheme.primary,
        ),
      ),
    );
  }
}

/// Circular progress ring that smoothly animates from 0 to [value] on first
/// build and whenever the target changes.
class AnimatedCircularProgress extends StatelessWidget {
  const AnimatedCircularProgress({
    super.key,
    required this.value,
    this.strokeWidth = 6,
    this.color,
    this.backgroundColor = AppColors.border,
  });

  final double value;
  final double strokeWidth;
  final Color? color;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0.0, 1.0).toDouble()),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, animatedValue, _) => CircularProgressIndicator(
        value: animatedValue,
        strokeWidth: strokeWidth,
        strokeCap: StrokeCap.round,
        backgroundColor: backgroundColor,
        color: color ?? theme.colorScheme.primary,
      ),
    );
  }
}

/// Numeric text that counts up from 0 to [value] when it first appears and
/// whenever the value changes.
class AnimatedCounter extends StatelessWidget {
  const AnimatedCounter({
    super.key,
    required this.value,
    this.style,
    this.prefix = '',
    this.suffix = '',
    this.duration = const Duration(milliseconds: 650),
  });

  final int value;
  final TextStyle? style;
  final String prefix;
  final String suffix;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<int>(
      tween: IntTween(begin: 0, end: value),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, animatedValue, _) =>
          Text('$prefix$animatedValue$suffix', style: style),
    );
  }
}
