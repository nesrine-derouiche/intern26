import 'package:flutter/material.dart';

/// Shared STEG visual tokens.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF12304A);

  /// Deeper brand blue used as the gradient partner on hero surfaces.
  static const Color primaryDark = Color(0xFF0B2135);

  /// Pale brand tint used for containers, chips and selected states.
  static const Color corporateBlue = Color(0xFF1769AA);
  static const Color electricBlue = Color(0xFF2F80ED);
  static const Color primaryTint = Color(0xFFE8F1F8);

  /// Secondary accents kept for data-viz and icon variety.
  static const Color violet = Color(0xFF52728C);
  static const Color purple = Color(0xFF6B8296);
  static const Color teal = Color(0xFF16845B);

  /// App background — very light cool slate.
  static const Color background = Color(0xFFF5F7FA);

  /// Card / surface fill — white.
  static const Color surface = Color(0xFFFFFFFF);

  /// Slightly tinted surface for nested blocks and inputs.
  static const Color surfaceTone = Color(0xFFF1F4F8);

  /// Quiet surface for hover / pressed states.
  static const Color surfaceMuted = Color(0xFFF9FAFC);

  static const Color textPrimary = Color(0xFF172B4D);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textTertiary = Color(0xFF94A3B8);

  /// Hairline separators — avoid heavy borders.
  static const Color border = Color(0xFFE2E8F0);

  static const Color success = Color(0xFF16845B);
  static const Color warning = Color(0xFFD97706);
  static const Color danger = Color(0xFFDC2626);
  static const Color info = corporateBlue;

  /// Signature brand gradient for hero headers.
  static const LinearGradient brandGradient = LinearGradient(
    colors: [primary, corporateBlue],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Secondary gradient used on stat highlights.
  static const LinearGradient violetGradient = LinearGradient(
    colors: [corporateBlue, primary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const List<BoxShadow> softShadow = [
    BoxShadow(
      color: Color(0x140F2740),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> softShadowSmall = [
    BoxShadow(
      color: Color(0x0D0F2740),
      blurRadius: 10,
      offset: Offset(0, 3),
    ),
  ];

  /// Deeper shadow for the hovered / lifted card state.
  static const List<BoxShadow> softShadowHover = [
    BoxShadow(
      color: Color(0x22112740),
      blurRadius: 20,
      offset: Offset(0, 8),
    ),
  ];
}
