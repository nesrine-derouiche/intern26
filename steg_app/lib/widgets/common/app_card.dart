import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Premium card — soft shadow, generous 28px radius, no heavy borders.
/// Optional tap feedback via [onTap]; interactive cards gently lift and
/// deepen their shadow while hovered.
class AppCard extends StatefulWidget {
  const AppCard({
    super.key,
    this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(20),
    this.color,
    this.radius,
    this.shadow = true,
  });

  final Widget? child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final double? radius;
  final bool shadow;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
  bool _hovered = false;

  void _onEnter(PointerEnterEvent _) {
    if (!mounted || _hovered) return;
    setState(() => _hovered = true);
  }

  void _onExit(PointerExitEvent _) {
    if (!mounted || !_hovered) return;
    setState(() => _hovered = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final borderRadius = BorderRadius.circular(widget.radius ?? AppTheme.radiusLg);
    final effectiveColor = widget.color ?? theme.colorScheme.surface;

    final baseShadow = widget.shadow ? AppColors.softShadow : null;
    final effectiveShadow = _hovered ? AppColors.softShadowHover : baseShadow;

    if (widget.onTap == null) {
      return AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: effectiveColor,
          borderRadius: borderRadius,
          boxShadow: effectiveShadow,
        ),
        padding: widget.padding,
        child: widget.child,
      );
    }

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: _onEnter,
      onExit: _onExit,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        transform: Matrix4.translationValues(0, _hovered ? -2 : 0, 0),
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          boxShadow: effectiveShadow,
        ),
        child: Material(
          color: Colors.transparent,
          child: Ink(
            decoration: BoxDecoration(
              color: effectiveColor,
              borderRadius: borderRadius,
            ),
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: borderRadius,
              splashColor: theme.colorScheme.primary.withValues(alpha: 0.08),
              highlightColor: Colors.black.withValues(alpha: 0.04),
              child: Padding(
                padding: widget.padding,
                child: widget.child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
