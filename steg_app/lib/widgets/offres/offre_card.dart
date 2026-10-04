import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/offre.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import 'offre_statut_badge.dart';

class OffreCard extends StatelessWidget {
  const OffreCard({super.key, required this.offre, required this.onTap});

  final Offre offre;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: Icons.business_outlined,
            color: AppColors.primary,
            title: offre.titre,
            heroTag: 'offre-titre-${offre.id}',
            subtitle: offre.departementNom.isEmpty
                ? 'Sans département'
                : offre.departementNom,
            badge: OffreStatutBadge(statut: offre.statut),
          ),
          if (offre.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              offre.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surfaceTone,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                _MetaItem(icon: Icons.schedule, text: offre.dureeLabel),
                _MetaItem(
                  icon: Icons.group_outlined,
                  text: '${offre.nombrePlaces} places',
                ),
                _MetaItem(
                  icon: Icons.event_outlined,
                  text: 'Avant le ${formatDateFr(offre.dateLimite)}',
                ),
                _MetaItem(
                  icon: Icons.how_to_reg_outlined,
                  text: '${offre.nbCandidatures} candidature(s)',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.textSecondary),
        const SizedBox(width: 5),
        Text(
          text,
          style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
