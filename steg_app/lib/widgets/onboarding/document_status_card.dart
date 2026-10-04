import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/document_onboarding.dart';

class DocumentStatusCard extends StatelessWidget {
  const DocumentStatusCard({
    super.key,
    required this.type,
    required this.document,
    required this.onUpload,
    this.busy = false,
  });

  final OnboardingDocumentType type;
  final OnboardingDocument document;
  final VoidCallback onUpload;
  final bool busy;

  static IconData _iconFor(OnboardingDocumentStatus status) {
    switch (status) {
      case OnboardingDocumentStatus.manquant:
      case OnboardingDocumentStatus.rejete:
        return Icons.upload_file_outlined;
      case OnboardingDocumentStatus.enAttente:
        return Icons.send_outlined;
      case OnboardingDocumentStatus.verification:
        return Icons.hourglass_top_outlined;
      case OnboardingDocumentStatus.reviewRequired:
        return Icons.fact_check_outlined;
      case OnboardingDocumentStatus.valide:
        return Icons.check_circle_outline;
    }
  }

  static Color _colorFor(OnboardingDocumentStatus status) {
    switch (status) {
      case OnboardingDocumentStatus.manquant:
      case OnboardingDocumentStatus.reviewRequired:
        return AppColors.warning;
      case OnboardingDocumentStatus.enAttente:
      case OnboardingDocumentStatus.verification:
        return AppColors.info;
      case OnboardingDocumentStatus.valide:
        return AppColors.success;
      case OnboardingDocumentStatus.rejete:
        return AppColors.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = document.status;
    final color = _colorFor(status);
    final isManquant = status == OnboardingDocumentStatus.manquant;
    // Tout document soumis est remplaçable : le backend remplace le précédent
    // (upsert) et repasse le document en EN_ATTENTE.
    final actionable = status != OnboardingDocumentStatus.valide;
    // Le sous-titre reprend le libellé du statut pour tout statut non validé.
    final subtitle =
        status == OnboardingDocumentStatus.valide ? null : status.label;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.softShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(_iconFor(status), size: 22, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type.label,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (status == OnboardingDocumentStatus.rejete &&
                    document.rejectedReason != null &&
                    document.rejectedReason!.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    document.rejectedReason!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (actionable)
            SizedBox(
              height: 40,
              child: busy
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: color,
                      ),
                    )
                  : FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: color),
                      onPressed: onUpload,
                      icon: Icon(
                        isManquant ? Icons.add : Icons.refresh,
                        size: 18,
                      ),
                      label: Text(isManquant ? 'Ajouter' : 'Remplacer'),
                    ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                status.label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
