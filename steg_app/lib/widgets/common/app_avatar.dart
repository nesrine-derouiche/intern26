import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Initials avatar with a soft gradient — used for entities without photos.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.name,
    this.initials,
    this.size = 40,
    this.background,
  });

  final String? name;
  final String? initials;
  final double size;
  final Color? background;

  static const List<Color> _palette = [
    AppColors.violet,
    AppColors.info,
    AppColors.teal,
    AppColors.warning,
    AppColors.primaryDark,
  ];

  String get _initials {
    if (initials != null && initials!.isNotEmpty) return initials!;
    final name = this.name ?? '?';
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.characters.first.toUpperCase();
    }
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final hash = (_initials).codeUnits.fold<int>(0, (a, b) => a + b);
    final color = background ?? _palette[hash % _palette.length];

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, color.withValues(alpha: 0.75)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
      ),
      child: Text(
        _initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.36,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
        ),
      ),
    );
  }
}
