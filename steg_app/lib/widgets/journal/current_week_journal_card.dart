import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/journal_entry.dart';
import '../common/app_card.dart';
import 'journal_status_chip.dart';

class CurrentWeekJournalCard extends StatelessWidget {
  const CurrentWeekJournalCard({
    super.key,
    this.currentWeekJournal,
    required this.onCreate,
    required this.onEdit,
    required this.onSubmit,
  });

  final JournalEntry? currentWeekJournal;
  final VoidCallback onCreate;
  final VoidCallback onEdit;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final journal = currentWeekJournal;
    final now = DateTime.now();
    final weekStart = startOfWeek(now);
    final weekEnd = weekStart.add(const Duration(days: 6));

    return AppCard(
      padding: const EdgeInsets.all(16),
      color: AppColors.primary.withValues(alpha: 0.04),
      shadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  gradient: AppColors.brandGradient,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.today_outlined,
                  size: 20,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Semaine en cours',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'du ${formatDateFr(weekStart)} au ${formatDateFr(weekEnd)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (journal != null) JournalStatusChip(statut: journal.statut),
            ],
          ),
          const SizedBox(height: 14),
          if (journal == null)
            _NoJournalPrompt(onCreate: onCreate)
          else
            _JournalSummary(journal: journal, onEdit: onEdit, onSubmit: onSubmit),
        ],
      ),
    );
  }
}

class _NoJournalPrompt extends StatelessWidget {
  const _NoJournalPrompt({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.edit_note, size: 20, color: AppColors.textTertiary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Aucun journal pour cette semaine.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ),
        FilledButton.icon(
          onPressed: onCreate,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Rédiger'),
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }
}

class _JournalSummary extends StatelessWidget {
  const _JournalSummary({
    required this.journal,
    required this.onEdit,
    required this.onSubmit,
  });

  final JournalEntry journal;
  final VoidCallback onEdit;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.schedule_outlined, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text(
              '${journal.heuresLabel} h',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            if (journal.offreTitre.isNotEmpty) ...[
              const SizedBox(width: 14),
              Icon(Icons.work_outline, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  journal.offreTitre,
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
          const SizedBox(height: 10),
          Text(
            journal.travaux,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall,
          ),
        ],
        if (journal.commentaireEncadrant.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.forum_outlined, size: 14, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    journal.commentaireEncadrant,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ],
        if (journal.isEditable) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 14),
                label: const Text('Modifier'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: onSubmit,
                icon: const Icon(Icons.send_outlined, size: 14),
                label: const Text('Soumettre'),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
