import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/document_item.dart';
import '../common/app_card.dart';
import '../common/app_card_header.dart';

class DocumentCard extends StatelessWidget {
  const DocumentCard({
    super.key,
    required this.document,
    this.onTap,
    this.onPreview,
    this.onDownload,
    this.onDelete,
  });

  final DocumentItem document;
  final VoidCallback? onTap;
  final VoidCallback? onPreview;
  final VoidCallback? onDownload;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final hasActions = onPreview != null || onDownload != null || onDelete != null;

    return AppCard(
      onTap: onTap ?? onPreview,
      padding: const EdgeInsets.all(14),
      child: AppCardHeader(
        icon: document.extension == 'PDF'
            ? Icons.picture_as_pdf_outlined
            : Icons.description_outlined,
        color: AppColors.primary,
        title: document.nom,
        subtitle: [
          document.typeLabel,
          if (document.dateDepot != null) formatDateFr(document.dateDepot),
        ].join(' · '),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (document.extension.isNotEmpty)
              Text(
                document.extension,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            if (hasActions) ...[
              const SizedBox(width: 4),
              PopupMenuButton<String>(
                tooltip: 'Actions',
                onSelected: (action) {
                  switch (action) {
                    case 'preview':
                      onPreview?.call();
                    case 'download':
                      onDownload?.call();
                    case 'delete':
                      onDelete?.call();
                  }
                },
                itemBuilder: (context) => [
                  if (onPreview != null)
                    const PopupMenuItem(
                      value: 'preview',
                      child: ListTile(
                        leading: Icon(Icons.visibility_outlined),
                        title: Text('Aperçu'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  if (onDownload != null)
                    const PopupMenuItem(
                      value: 'download',
                      child: ListTile(
                        leading: Icon(Icons.download_outlined),
                        title: Text('Télécharger'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  if (onDelete != null)
                    const PopupMenuItem(
                      value: 'delete',
                      child: ListTile(
                        leading: Icon(Icons.delete_outline, color: AppColors.danger),
                        title: Text('Supprimer'),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
