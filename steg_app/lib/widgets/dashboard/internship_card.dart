import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/internship.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import 'stage_statut_badge.dart';

class InternshipCard extends StatelessWidget {
  const InternshipCard({super.key, required this.internship, this.onTap});

  final Internship internship;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final progress = internship.progress;
    final subtitleParts = <String>[
      if (internship.departementNom.isNotEmpty) internship.departementNom,
      internship.periodeLabel,
      if (internship.dureeSemaines > 0) '${internship.dureeSemaines} sem.',
    ];

    return AppCard(
      onTap: onTap,
      child: AppCardHeader(
        icon: Icons.work_outline,
        color: AppColors.primary,
        title: internship.titre,
        subtitle: subtitleParts.join(' · '),
        badge: StageStatutBadge(statut: internship.statut),
        progress: progress / 100,
        progressLabel: '$progress %',
        progressColor: internship.isActive ? AppColors.primary : AppColors.success,
      ),
    );
  }
}
