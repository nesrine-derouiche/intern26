import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/completion_data.dart';
import '../../providers/stagiaire/completion_provider.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

class CompletionScreen extends ConsumerWidget {
  const CompletionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final completionAsync = ref.watch(completionProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('État du stage'),
      ),
      body: completionAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorView(
          message: error.toString(),
          onRetry: () => ref.refresh(completionProvider.future),
        ),
        data: (data) => data.stage == null
            ? const EmptyState(
                icon: Icons.work_off_outlined,
                title: 'Aucun stage',
                message: 'Aucune information de stage disponible.',
              )
            : _CompletionBody(data: data),
      ),
    );
  }
}

class _CompletionBody extends StatelessWidget {
  const _CompletionBody({required this.data});

  final CompletionData data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _StatusHero(data: data),
        const SizedBox(height: 16),
        _StageInfo(stage: data.stage!),
        if (data.hasEvaluation) ...[
          const SizedBox(height: 16),
          _EvaluationCard(evaluation: data.evaluation!),
        ],
        if (data.isCompleted && data.availableDocuments.isNotEmpty) ...[
          const SizedBox(height: 16),
          _DocumentsSection(documents: data.availableDocuments, stageId: data.stage!.id),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

class _StatusHero extends StatelessWidget {
  const _StatusHero({required this.data});

  final CompletionData data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final completed = data.isCompleted;
    final color = completed ? AppColors.success : AppColors.primary;
    final icon = completed ? Icons.verified_outlined : Icons.hourglass_top_outlined;
    final title = completed ? 'Stage terminé' : 'Stage en cours';
    final subtitle = completed
        ? (data.completionDate != null
            ? 'Terminé le ${formatDateFr(data.completionDate!)}'
            : 'Terminé')
        : 'En attente de finalisation';

    return AppCard(
      padding: EdgeInsets.zero,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [color.withValues(alpha: 0.08), color.withValues(alpha: 0.02)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (completed && data.hasEvaluation) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'Note finale : ${data.evaluation!.noteLabel}/20',
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: color,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StageInfo extends StatelessWidget {
  const _StageInfo({required this.stage});

  final CompletionStage stage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Informations du stage',
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          _InfoRow(icon: Icons.work_outline, label: 'Sujet', value: stage.offreTitre),
          const SizedBox(height: 8),
          _InfoRow(icon: Icons.business_outlined, label: 'Département', value: stage.departementNom),
          const SizedBox(height: 8),
          _InfoRow(icon: Icons.person_outline, label: 'Encadrant', value: stage.encadrantFullName),
          const SizedBox(height: 8),
          _InfoRow(icon: Icons.calendar_today_outlined, label: 'Période', value: stage.periodeLabel),
        ],
      ),
    );
  }
}

class _EvaluationCard extends StatelessWidget {
  const _EvaluationCard({required this.evaluation});

  final CompletionEvaluation evaluation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.grading_outlined, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'Évaluation finale',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          if (evaluation.encadrantFullName.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Par ${evaluation.encadrantFullName}',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
          if (evaluation.dateEvaluation != null) ...[
            const SizedBox(height: 2),
            Text(
              'Le ${formatDateFr(evaluation.dateEvaluation!)}',
              style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 16),
          _CriteriaBar(label: 'Compétences techniques', value: evaluation.technique),
          const SizedBox(height: 8),
          _CriteriaBar(label: 'Communication', value: evaluation.communication),
          const SizedBox(height: 8),
          _CriteriaBar(label: 'Autonomie', value: evaluation.autonomie),
          const SizedBox(height: 8),
          _CriteriaBar(label: 'Ponctualité', value: evaluation.ponctualite),
          const SizedBox(height: 8),
          _CriteriaBar(label: 'Qualité du travail', value: evaluation.qualite),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Moyenne générale : ',
                  style: theme.textTheme.bodyLarge,
                ),
                Text(
                  '${evaluation.noteLabel}/20',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
          ),
          if (evaluation.commentaire != null &&
              evaluation.commentaire!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'Commentaire',
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              evaluation.commentaire!,
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}

class _CriteriaBar extends StatelessWidget {
  const _CriteriaBar({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fraction = value / 20.0;
    final color = fraction >= 0.75
        ? AppColors.success
        : fraction >= 0.5
            ? AppColors.warning
            : AppColors.danger;

    return Row(
      children: [
        SizedBox(
          width: 150,
          child: Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: fraction,
              backgroundColor: AppColors.textSecondary.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 8,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 48,
          child: Text(
            '$value/20',
            textAlign: TextAlign.right,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DocumentsSection extends StatelessWidget {
  const _DocumentsSection({required this.documents, required this.stageId});

  final List<String> documents;
  final String stageId;

  static const _labels = {
    'convention': ('Convention de stage', Icons.description_outlined),
    'attestation': ('Attestation de stage', Icons.verified_outlined),
    'evaluation': ('Fiche d\'évaluation', Icons.grading_outlined),
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.download_outlined, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'Documents disponibles',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final doc in documents) ...[
            if (doc != documents.first) const Divider(height: 1),
            _DocumentTile(
              label: _labels[doc]?.$1 ?? doc,
              icon: _labels[doc]?.$2 ?? Icons.description_outlined,
              stageId: stageId,
              kind: doc,
            ),
          ],
        ],
      ),
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({
    required this.label,
    required this.icon,
    required this.stageId,
    required this.kind,
  });

  final String label;
  final IconData icon;
  final String stageId;
  final String kind;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          gradient: AppColors.brandGradient,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, size: 20, color: Colors.white),
      ),
      title: Text(
        label,
        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        'PDF téléchargeable',
        style: theme.textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Téléchargement de $label...')),
        );
      },
    );
  }
}
