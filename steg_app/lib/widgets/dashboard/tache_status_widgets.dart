import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/tache.dart';
import '../common/status_pill.dart';

class TacheStatutBadge extends StatelessWidget {
  const TacheStatutBadge({super.key, required this.statut});

  final String statut;

  static Color color(String statut) {
    return switch (statut) {
      'A_FAIRE' => AppColors.textSecondary,
      'EN_COURS' => AppColors.info,
      'TERMINEE' => AppColors.success,
      'BLOQUEE' => AppColors.danger,
      _ => AppColors.primary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final parsed = TacheStatut.fromValue(statut);
    final label = parsed?.label ?? (statut.isEmpty ? 'Inconnu' : statut);
    return StatusPill(label: label, color: color(statut));
  }
}

class TachePrioriteChip extends StatelessWidget {
  const TachePrioriteChip({super.key, required this.priorite});

  final String priorite;

  static Color color(String priorite) {
    return switch (priorite) {
      'BASSE' => AppColors.textSecondary,
      'MOYENNE' => AppColors.info,
      'HAUTE' => AppColors.warning,
      'URGENTE' => AppColors.danger,
      _ => AppColors.primary,
    };
  }

  @override
  Widget build(BuildContext context) {
    final parsed = TachePriorite.fromValue(priorite);
    final label = parsed?.label ?? (priorite.isEmpty ? 'Moyenne' : priorite);
    return StatusPill(
      label: label,
      color: color(priorite),
      dot: false,
    );
  }
}
