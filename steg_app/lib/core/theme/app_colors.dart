import 'package:flutter/material.dart';

/// Design tokens — modern enterprise palette.
///
/// Cool slate surfaces with an enterprise blue brand, inspired by the
/// Apple Human Interface Guidelines, LinkedIn and Linear.
class AppColors {
  AppColors._();

  /// Brand — enterprise blue.
  static const Color primary = Color(0xFF0066CC);

  /// Deeper brand blue used as the gradient partner on hero surfaces.
  static const Color primaryDark = Color(0xFF004C9E);

  /// Pale brand tint used for containers, chips and selected states.
  static const Color primaryTint = Color(0xFFE8F1FB);

  /// Secondary accents kept for data-viz and icon variety.
  static const Color violet = Color(0xFF7C3AED);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color teal = Color(0xFF0EA5A4);

  /// App background — very light cool slate.
  static const Color background = Color(0xFFF8FAFC);

  /// Card / surface fill — white.
  static const Color surface = Color(0xFFFFFFFF);

  /// Slightly tinted surface for nested blocks and inputs.
  static const Color surfaceTone = Color(0xFFF1F5F9);

  /// Quiet surface for hover / pressed states.
  static const Color surfaceMuted = Color(0xFFF8FAFC);

  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textTertiary = Color(0xFF9CA3AF);

  /// Hairline separators — avoid heavy borders.
  static const Color border = Color(0xFFE5E7EB);

  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);
  static const Color info = Color(0xFF0066CC);

  /// Signature brand gradient for hero headers.
  static const LinearGradient brandGradient = LinearGradient(
    colors: [primary, primaryDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Secondary gradient used on stat highlights.
  static const LinearGradient violetGradient = LinearGradient(
    colors: [violet, primaryDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const List<BoxShadow> softShadow = [
    BoxShadow(
      color: Color(0x140F1728),
      blurRadius: 20,
      offset: Offset(0, 6),
    ),
  ];

  static const List<BoxShadow> softShadowSmall = [
    BoxShadow(
      color: Color(0x0D0F1728),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  /// Deeper shadow for the hovered / lifted card state.
  static const List<BoxShadow> softShadowHover = [
    BoxShadow(
      color: Color(0x26111C33),
      blurRadius: 28,
      offset: Offset(0, 12),
    ),
  ];
}
