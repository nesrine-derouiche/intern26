import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class PointageButton extends StatelessWidget {
  const PointageButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.isLoading = false,
    this.isEnabled = true,
    this.color = AppColors.success,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isEnabled;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final effectiveOnPressed = (isLoading || !isEnabled) ? null : onPressed;

    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: effectiveOnPressed,
        icon: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Icon(icon),
        label: Text(label),
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: color,
          disabledBackgroundColor: color.withValues(alpha: 0.5),
        ),
      ),
    );
  }
}
