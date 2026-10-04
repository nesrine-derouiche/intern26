import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Material 3 design system shared by every STEG surface.
class AppTheme {
  AppTheme._();

  static const String fontFamily = 'Inter';
  static const double radius = 16;
  static const double radiusLg = 18;
  static const double radiusSm = 12;
  static const double radiusPill = 999;

  static ThemeData get light => _build(Brightness.light);

  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: brightness,
      surface: AppColors.surface,
    ).copyWith(
      primary: isLight ? AppColors.primary : const Color(0xFF8BC4F4),
      onPrimary: isLight ? Colors.white : const Color(0xFF00315F),
      primaryContainer: isLight ? AppColors.primaryTint : const Color(0xFF16496C),
      onPrimaryContainer: isLight ? AppColors.primary : const Color(0xFFD7ECFF),
      secondary: isLight ? AppColors.success : const Color(0xFF4DE38B),
      onSecondary: Colors.white,
      secondaryContainer: isLight ? const Color(0xFFD7F5E1) : const Color(0xFF0E5130),
      onSecondaryContainer: isLight ? const Color(0xFF0B4A26) : const Color(0xFFAEF7C8),
      tertiary: AppColors.electricBlue,
      onTertiary: Colors.white,
      surface: isLight ? AppColors.surface : const Color(0xFF151D2C),
      surfaceContainerLowest: isLight ? AppColors.surface : const Color(0xFF101827),
      surfaceContainerLow: isLight ? AppColors.surfaceMuted : const Color(0xFF182132),
      surfaceContainer: isLight ? AppColors.surfaceTone : const Color(0xFF1D2838),
      surfaceContainerHigh: isLight ? const Color(0xFFE8ECF3) : const Color(0xFF243143),
      surfaceContainerHighest: isLight ? const Color(0xFFE0E6EE) : const Color(0xFF2C3A4D),
      outline: isLight ? AppColors.border : const Color(0xFF334155),
      outlineVariant: isLight ? const Color(0xFFE3E8EF) : const Color(0xFF26303F),
      onSurface: isLight ? AppColors.textPrimary : const Color(0xFFF1F5F9),
      onSurfaceVariant: isLight ? AppColors.textSecondary : const Color(0xFF94A3B8),
      error: AppColors.danger,
      onError: Colors.white,
      shadow: isLight ? const Color(0x140F2740) : const Color(0x66000000),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor:
          isLight ? AppColors.background : const Color(0xFF0F172A),
      materialTapTargetSize: MaterialTapTargetSize.padded,
      splashFactory: InkRipple.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: _SmoothPageTransitionsBuilder(),
          TargetPlatform.iOS: _SmoothPageTransitionsBuilder(),
          TargetPlatform.macOS: _SmoothPageTransitionsBuilder(),
          TargetPlatform.windows: _SmoothPageTransitionsBuilder(),
          TargetPlatform.linux: _SmoothPageTransitionsBuilder(),
        },
      ),
      textTheme: _textTheme(brightness),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: colorScheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 20,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
          color: colorScheme.onSurface,
        ),
        toolbarHeight: 60,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: const Color(0x140F1728),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isLight ? const Color(0xFFF1F6FB) : const Color(0xFF1D2838),
        hintStyle: TextStyle(
          color: isLight ? AppColors.textTertiary : const Color(0xFF64748B),
          fontWeight: FontWeight.w500,
        ),
        labelStyle: TextStyle(
          color: isLight ? AppColors.textSecondary : const Color(0xFF94A3B8),
          fontWeight: FontWeight.w500,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        prefixIconColor: isLight ? AppColors.textTertiary : const Color(0xFF64748B),
        suffixIconColor: isLight ? AppColors.textTertiary : const Color(0xFF64748B),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide(
            color: colorScheme.primary,
            width: 1.6,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.6),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(64, 52),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSm),
          ),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colorScheme.onSurface,
          minimumSize: const Size(64, 48),
          side: BorderSide(
            color: isLight ? AppColors.border : const Color(0xFF334155),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSm),
          ),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colorScheme.primary,
          minimumSize: const Size(56, 44),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: TextStyle(
            fontFamily: fontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        elevation: 0,
        focusElevation: 0,
        highlightElevation: 0,
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        extendedTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: isLight ? AppColors.surfaceTone : const Color(0xFF1D2838),
        selectedColor: colorScheme.primary,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusPill),
        ),
        labelStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        iconTheme: IconThemeData(color: colorScheme.primary, size: 18),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusSm),
        ),
        backgroundColor: isLight ? AppColors.textPrimary : const Color(0xFF243143),
        contentTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLg),
        ),
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          letterSpacing: 0,
          color: colorScheme.onSurface,
        ),
        contentTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 14,
          height: 1.5,
          color: colorScheme.onSurfaceVariant,
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        showDragHandle: true,
        dragHandleColor: isLight ? AppColors.border : const Color(0xFF334155),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(radiusLg)),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: isLight ? AppColors.border : const Color(0xFF26303F),
        thickness: 1,
        space: 1,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colorScheme.primary,
        linearTrackColor:
            isLight ? const Color(0xFFE4E7EC) : const Color(0xFF243143),
        circularTrackColor:
            isLight ? const Color(0xFFE4E7EC) : const Color(0xFF243143),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : colorScheme.onSurfaceVariant,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? AppColors.primary
              : isLight
                  ? const Color(0xFFD0D5DD)
                  : const Color(0xFF334155),
        ),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: colorScheme.onSurfaceVariant,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 15,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface,
        ),
        subtitleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 13,
          height: 1.35,
          color: colorScheme.onSurfaceVariant,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 72,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        indicatorColor: isLight
            ? AppColors.primary.withValues(alpha: 0.12)
            : const Color(0xFF0066CC).withValues(alpha: 0.22),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.primary : AppColors.textSecondary,
            size: 24,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontFamily: fontFamily,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            color: selected ? AppColors.primary : AppColors.textSecondary,
          );
        }),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          textStyle: WidgetStatePropertyAll(
            TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
          ),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusSm)),
          ),
        ),
      ),
    );
  }

  static TextTheme _textTheme(Brightness brightness) {
    final onSurface =
        brightness == Brightness.light ? AppColors.textPrimary : const Color(0xFFF1F5F9);
    final secondary = brightness == Brightness.light
        ? AppColors.textSecondary
        : const Color(0xFF94A3B8);

    const family = fontFamily;
    return TextTheme(
      displayLarge: TextStyle(
          fontFamily: family, fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: -1.2, color: onSurface),
      displayMedium: TextStyle(
          fontFamily: family, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.9, color: onSurface),
      displaySmall: TextStyle(
          fontFamily: family, fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.7, color: onSurface),
      headlineLarge: TextStyle(
          fontFamily: family, fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: onSurface),
      headlineMedium: TextStyle(
          fontFamily: family, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: onSurface),
      headlineSmall: TextStyle(
          fontFamily: family, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: onSurface),
      titleLarge: TextStyle(
          fontFamily: family, fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.2, color: onSurface),
      titleMedium: TextStyle(
          fontFamily: family, fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.15, color: onSurface),
      titleSmall: TextStyle(
          fontFamily: family, fontSize: 14, fontWeight: FontWeight.w600, letterSpacing: -0.05, color: onSurface),
      bodyLarge: TextStyle(
          fontFamily: family, fontSize: 16, height: 1.5, color: onSurface),
      bodyMedium: TextStyle(
          fontFamily: family, fontSize: 14, height: 1.45, color: onSurface),
      bodySmall: TextStyle(
          fontFamily: family, fontSize: 12.5, height: 1.4, color: secondary),
      labelLarge: TextStyle(
          fontFamily: family, fontSize: 14, fontWeight: FontWeight.w600, color: onSurface),
      labelMedium: TextStyle(
          fontFamily: family, fontSize: 12, fontWeight: FontWeight.w600, color: onSurface),
      labelSmall: TextStyle(
          fontFamily: family, fontSize: 11, fontWeight: FontWeight.w600, color: secondary),
    );
  }
}

/// Premium page transition: the incoming page fades in, glides up and scales
/// from 0.98 → 1.0, while the page underneath gently scales down and blurs
/// out of focus for a layered "lift" effect. All animated properties are
/// compositor-friendly (opacity, transform) so the whole flight stays at 60fps.
class _SmoothPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SmoothPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );

    final scale = Tween<double>(begin: 0.98, end: 1).animate(curved);

    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curved),
        child: ScaleTransition(
          scale: scale,
          child: child,
        ),
      ),
    );
  }
}
