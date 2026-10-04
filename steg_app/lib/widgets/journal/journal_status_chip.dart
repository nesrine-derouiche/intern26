import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/journal_entry.dart';
import '../common/status_pill.dart';

class JournalStatusChip extends StatelessWidget {
  const JournalStatusChip({super.key, required this.statut});

  final JournalStatut statut;

  static Color color(JournalStatut statut) {
    return switch (statut) {
      JournalStatut.brouillon => AppColors.textSecondary,
      JournalStatut.soumis => AppColors.info,
      JournalStatut.valide => AppColors.success,
      JournalStatut.rejete => AppColors.danger,
    };
  }

  @override
  Widget build(BuildContext context) {
    return StatusPill(label: statut.label, color: color(statut));
  }
}
