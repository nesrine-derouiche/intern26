import 'package:flutter/material.dart';

/// Quiet placeholder block used across loading skeletons, with a soft
/// animated sheen that sweeps across while content is loading.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    required this.width,
    required this.height,
    this.radius = 6,
  });

  final double width;
  final double height;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final sweep = _controller.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(-1.4 + 2.8 * sweep, -0.3),
              end: Alignment(1.4 + 2.8 * sweep, 0.3),
              colors: [
                scheme.outlineVariant.withValues(alpha: 0.8),
                scheme.surfaceContainerLow.withValues(alpha: 0.9),
                scheme.outlineVariant.withValues(alpha: 0.8),
              ],
            ),
          ),
        );
      },
    );
  }
}
