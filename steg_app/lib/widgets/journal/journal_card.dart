import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/journal_entry.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';
import 'journal_status_chip.dart';

class JournalCard extends StatelessWidget {
  const JournalCard({
    super.key,
    required this.journal,
    this.onEdit,
    this.onSubmit,
    this.onValidate,
    this.onReject,
    this.onDelete,
  });

  final JournalEntry journal;
  final VoidCallback? onEdit;
  final VoidCallback? onSubmit;
  final VoidCallback? onValidate;
  final VoidCallback? onReject;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCardHeader(
            icon: Icons.menu_book_outlined,
            color: AppColors.primary,
            title: journal.semaineRangeLabel,
            badge: JournalStatusChip(statut: journal.statut),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.schedule_outlined,
                size: 15,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Text(
                '${journal.heuresLabel} h',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              if (journal.stagiaireFullName.isNotEmpty) ...[
                const SizedBox(width: 14),
                const Icon(
                  Icons.person_outline,
                  size: 15,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    journal.stagiaireFullName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (journal.travaux.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Travaux réalisés',
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              journal.travaux,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ],
          if (journal.competences.isNotEmpty) ...[
            const SizedBox(height: 12),
            _InlineTag(
              icon: Icons.school_outlined,
              label: 'Compétences : ${journal.competences}',
            ),
          ],
          if (journal.commentaireEncadrant.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.forum_outlined,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Commentaire de l\'encadrant',
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    journal.commentaireEncadrant,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
          if (onEdit != null ||
              onSubmit != null ||
              onValidate != null ||
              onReject != null ||
              onDelete != null) ...[
            const Divider(height: 24),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (onEdit != null)
                  OutlinedButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Modifier'),
                  ),
                if (onSubmit != null)
                  FilledButton.icon(
                    onPressed: onSubmit,
                    icon: const Icon(Icons.send_outlined, size: 18),
                    label: const Text('Soumettre'),
                  ),
                if (onValidate != null)
                  FilledButton.icon(
                    onPressed: onValidate,
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text('Valider'),
                  ),
                if (onReject != null)
                  OutlinedButton.icon(
                    onPressed: onReject,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                    ),
                    icon: const Icon(Icons.cancel_outlined, size: 18),
                    label: const Text('Rejeter'),
                  ),
                if (onDelete != null)
                  IconButton(
                    tooltip: 'Supprimer',
                    onPressed: onDelete,
                    icon: const Icon(Icons.delete_outline),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _InlineTag extends StatelessWidget {
  const _InlineTag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
