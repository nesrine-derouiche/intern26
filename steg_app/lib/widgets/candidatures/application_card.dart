import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/application_status.dart';
import '../../models/candidature.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import '../common/status_pill.dart';
import 'application_status_badge.dart';

class ApplicationCard extends StatelessWidget {
  const ApplicationCard({super.key, required this.candidature});

  final Candidature candidature;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = ApplicationStatut.fromValue(candidature.statut);
    final title = candidature.offreTitre.isEmpty
        ? 'Offre sans titre'
        : candidature.offreTitre;

    return AppCard(
      onTap: () => context.push(
        RoutePaths.candidatureDetails.replaceFirst(':id', candidature.id),
        extra: candidature,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: Icons.fact_check_outlined,
            color: AppColors.primary,
            title: title,
            subtitle: candidature.departementNom.isEmpty
                ? null
                : candidature.departementNom,
            badge: status != null
                ? ApplicationStatusBadge(status: status)
                : StatusPill(label: _fallbackLabel(candidature.statut)),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceTone,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.event_outlined,
                  size: 15,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  'Postulé le ${formatDateFr(candidature.dateCandidature)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _fallbackLabel(String statut) =>
      statut.isEmpty ? 'Inconnu' : statut;
}
