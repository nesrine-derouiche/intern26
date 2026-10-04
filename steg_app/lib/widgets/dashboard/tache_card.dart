import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/tache.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import '../common/status_pill.dart';
import 'tache_status_widgets.dart';

class TacheCard extends StatelessWidget {
  const TacheCard({super.key, required this.tache, this.onTap});

  final Tache tache;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statut = tache.statut;
    final accent = statut == 'TERMINEE'
        ? AppColors.success
        : tache.estEnRetard
            ? AppColors.danger
            : AppColors.primary;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: statut == 'TERMINEE'
                ? Icons.task_alt
                : Icons.checklist_outlined,
            color: accent,
            title: tache.titre,
            subtitle: [
              if (tache.projetTitre.isNotEmpty) tache.projetTitre,
              if (tache.description.isNotEmpty) tache.description,
            ].join(' · '),
            badge: TacheStatutBadge(statut: statut),
            progress: (tache.progress / 100).clamp(0.0, 1.0),
            progressLabel: '${tache.progress}%',
            progressColor: accent,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TachePrioriteChip(priorite: tache.priorite),
              if (tache.estEnRetard)
                const _RetardTag()
              else
                Text(
                  tache.echeanceLabel,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RetardTag extends StatelessWidget {
  const _RetardTag();

  @override
  Widget build(BuildContext context) {
    return StatusPill(
      label: 'En retard',
      color: AppColors.danger,
      icon: Icons.warning_amber_rounded,
      dot: false,
    );
  }
}
