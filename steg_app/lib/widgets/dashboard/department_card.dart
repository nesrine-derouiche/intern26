import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';

class DepartmentCard extends StatelessWidget {
  const DepartmentCard({
    super.key,
    required this.name,
    this.nbEncadrants,
    this.nbStagesActifs,
    this.onTap,
  });

  final String name;
  final int? nbEncadrants;
  final int? nbStagesActifs;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final hasStats = nbEncadrants != null || nbStagesActifs != null;
    final subtitleParts = <String>['Mon département'];
    if (hasStats) {
      subtitleParts.add(
        [
          if (nbEncadrants != null)
            '$nbEncadrants encadrant${nbEncadrants == 1 ? '' : 's'}',
          if (nbStagesActifs != null)
            '$nbStagesActifs stage${nbStagesActifs == 1 ? '' : 's'} actif${nbStagesActifs == 1 ? '' : 's'}',
        ].join(' · '),
      );
    }

    return AppCard(
      onTap: onTap,
      child: AppCardHeader(
        icon: Icons.apartment_outlined,
        color: AppColors.primary,
        title: name.isEmpty ? '—' : name,
        subtitle: subtitleParts.join(' · '),
        trailing: hasStats
            ? Icon(
                Icons.chevron_right,
                size: 18,
                color: AppColors.textSecondary.withValues(alpha: 0.6),
              )
            : null,
      ),
    );
  }
}
