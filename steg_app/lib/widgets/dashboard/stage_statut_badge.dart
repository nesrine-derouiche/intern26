import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/status_pill.dart';

class StageStatutBadge extends StatelessWidget {
  const StageStatutBadge({super.key, required this.statut});

  final String statut;

  static String label(String statut) {
    return switch (statut) {
      'EN_COURS' => 'En cours',
      'TERMINE' => 'Terminé',
      'SUSPENDU' => 'Suspendu',
      'ANNULE' => 'Annulé',
      'EN_ATTENTE' => 'En attente',
      _ => statut,
    };
  }

  static Color color(String statut) {
    return switch (statut) {
      'EN_COURS' => AppColors.success,
      'TERMINE' => AppColors.info,
      'SUSPENDU' => AppColors.warning,
      'ANNULE' => AppColors.danger,
      'EN_ATTENTE' => AppColors.textSecondary,
      _ => AppColors.primary,
    };
  }

  @override
  Widget build(BuildContext context) {
    return StatusPill(label: label(statut), color: color(statut));
  }
}
