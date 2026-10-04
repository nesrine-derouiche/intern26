import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/supervisor_info.dart';
import '../common/app_avatar.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import '../common/status_pill.dart';

class SupervisorCard extends StatelessWidget {
  const SupervisorCard({super.key, required this.supervisor, this.onTap});

  final SupervisorInfo supervisor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = supervisor.fullName;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            leading: AppAvatar(name: name, size: 52),
            icon: Icons.person_outline,
            color: AppColors.primary,
            title: name,
            subtitle: supervisor.service?.isNotEmpty == true
                ? supervisor.service
                : null,
            badge: StatusPill(
              label: '${supervisor.nbStagiairesActifs} actif(s)',
              color: AppColors.success,
            ),
          ),
          if (supervisor.email != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(
                  Icons.mail_outline,
                  size: 15,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    supervisor.email!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
