import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/subtask.dart';

/// Shared status colours for the Todo interaction.
Color subtaskStatusColor(SubtaskStatus status) {
  switch (status) {
    case SubtaskStatus.todo:
      return AppColors.textSecondary;
    case SubtaskStatus.inProgress:
      return AppColors.info;
    case SubtaskStatus.done:
      return AppColors.success;
  }
}

/// Left status control of a subtask row — a compact, rounded circle that
/// reads like Apple Reminders:
///
/// * `TODO`       → empty circle `○`
/// * `IN_PROGRESS`→ half-filled circle `◐`
/// * `DONE`       → check circle `✓`
///
/// The control is decorative by default; pass [onTap] to make it tappable
/// (the caller opens the status selector). It never cycles states by itself.
class TodoStatusControl extends StatelessWidget {
  const TodoStatusControl({
    super.key,
    required this.status,
    this.size = 28,
    this.loading = false,
    this.onTap,
  });

  final SubtaskStatus status;
  final double size;
  final bool loading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = subtaskStatusColor(status);
    final isDone = status == SubtaskStatus.done && !loading;

    final Widget glyph;
    if (loading) {
      glyph = SizedBox(
        width: size * 0.55,
        height: size * 0.55,
        child: const CircularProgressIndicator(strokeWidth: 2),
      );
    } else {
      glyph = switch (status) {
        SubtaskStatus.todo => const SizedBox.shrink(),
        SubtaskStatus.inProgress => CustomPaint(
            size: Size.square(size * 0.62),
            painter: _HalfFillPainter(color),
          ),
        SubtaskStatus.done => Icon(
            Icons.check_rounded,
            size: size * 0.62,
            color: Colors.white,
          ),
      };
    }

    final control = AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: loading
            ? AppColors.surfaceTone
            : (isDone ? color : Colors.transparent),
        border: Border.all(
          color: loading ? AppColors.border : color,
          width: 2,
        ),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        switchInCurve: Curves.easeOut,
        switchOutCurve: Curves.easeIn,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: ScaleTransition(scale: animation, child: child),
        ),
        child: KeyedSubtree(
          key: ValueKey('${status.name}-$loading'),
          child: glyph,
        ),
      ),
    );

    final content = onTap == null
        ? control
        : GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: control,
          );

    return Semantics(
      button: onTap != null,
      label: 'Statut : ${status.label}',
      excludeSemantics: true,
      child: Padding(
        padding: EdgeInsets.all(size < 44 ? (44 - size) / 2 : 0),
        child: content,
      ),
    );
  }
}

/// Left half disc used for the `IN_PROGRESS` (`◐`) state.
class _HalfFillPainter extends CustomPainter {
  const _HalfFillPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    canvas.drawArc(
      Offset.zero & size,
      // 6 o'clock → clockwise half turn = left half, i.e. ◐.
      math.pi / 2,
      math.pi,
      true,
      paint,
    );
  }

  @override
  bool shouldRepaint(_HalfFillPainter oldDelegate) =>
      oldDelegate.color != color;
}
