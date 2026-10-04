import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/reunion.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import '../common/status_pill.dart';

class ReunionCard extends StatelessWidget {
  const ReunionCard({super.key, required this.reunion, this.onTap});

  final Reunion reunion;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final upcoming = reunion.estAVenir;
    final hasVisio = reunion.lienVisio != null && reunion.lienVisio!.isNotEmpty;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: hasVisio ? Icons.videocam_outlined : Icons.event_outlined,
            color: upcoming ? AppColors.success : AppColors.textSecondary,
            title: reunion.sujet,
            subtitle: '${formatDateFr(reunion.date)} à ${reunion.heureLabel}',
            badge: StatusPill(
              label: upcoming ? 'À venir' : 'Passée',
              color: upcoming ? AppColors.success : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Icon(
                hasVisio ? Icons.videocam_outlined : Icons.meeting_room_outlined,
                size: 15,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  hasVisio
                      ? 'Visio disponible'
                      : (reunion.salle?.isNotEmpty == true
                          ? 'Salle ${reunion.salle}'
                          : 'Salle à confirmer'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(
                Icons.person_outline,
                size: 15,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  reunion.encadrantFullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
