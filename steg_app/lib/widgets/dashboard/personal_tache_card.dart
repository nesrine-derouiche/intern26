import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/personal_tache.dart';

class PersonalTacheCard extends StatelessWidget {
  const PersonalTacheCard({
    super.key,
    required this.tache,
    this.onTap,
    this.onLongPress,
  });

  final PersonalTache tache;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return LongPressDraggable<PersonalTache>(
      data: tache,
      onDragStarted: () {},
      feedback: Material(
        elevation: 8,
        borderRadius: BorderRadius.circular(14),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 260),
          child: _buildCardContent(context, theme, isDragging: true),
        ),
      ),
      childWhenDragging: Opacity(
        opacity: 0.3,
        child: _buildCardContent(context, theme),
      ),
      child: DragTarget<PersonalTache>(
        onWillAcceptWithDetails: (details) => details.data.id != tache.id,
        builder: (context, candidateData, rejectedData) {
          final isHovering = candidateData.isNotEmpty;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: isHovering
                  ? Border.all(color: AppColors.primary, width: 2)
                  : null,
            ),
            child: GestureDetector(
              onTap: onTap,
              onLongPress: onLongPress,
              child: _buildCardContent(context, theme),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCardContent(BuildContext context, ThemeData theme, {bool isDragging = false}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDragging
            ? AppColors.primaryTint
            : theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: isDragging ? null : AppColors.softShadowSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            tache.titre,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          if (tache.description != null && tache.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              tache.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              if (tache.priorite != null) ...[
                _PriorityChip(priorite: tache.priorite!),
                const SizedBox(width: 6),
              ],
              if (tache.dateEcheance != null) ...[
                Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.textTertiary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    tache.dateEcheance!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _PriorityChip extends StatelessWidget {
  const _PriorityChip({required this.priorite});
  final String priorite;

  @override
  Widget build(BuildContext context) {
    final color = switch (priorite) {
      'HAUTE' => AppColors.danger,
      'MOYENNE' => AppColors.warning,
      'BASSE' => AppColors.textTertiary,
      _ => AppColors.textTertiary,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        priorite[0] + priorite.substring(1).toLowerCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
