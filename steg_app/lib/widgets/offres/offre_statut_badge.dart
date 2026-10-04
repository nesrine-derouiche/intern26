import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/status_pill.dart';

class OffreStatutBadge extends StatelessWidget {
  const OffreStatutBadge({super.key, required this.statut});

  final String statut;

  static String label(String statut) {
    return switch (statut) {
      'OUVERTE' => 'Ouverte',
      'FERMEE' => 'Fermée',
      'EXPIREE' => 'Expirée',
      'POURVUE' => 'Pourvue',
      _ => statut,
    };
  }

  static Color color(String statut) {
    return switch (statut) {
      'OUVERTE' => AppColors.success,
      'FERMEE' => AppColors.textSecondary,
      'EXPIREE' => AppColors.danger,
      'POURVUE' => AppColors.info,
      _ => AppColors.primary,
    };
  }

  @override
  Widget build(BuildContext context) {
    return StatusPill(label: label(statut), color: color(statut));
  }
}
