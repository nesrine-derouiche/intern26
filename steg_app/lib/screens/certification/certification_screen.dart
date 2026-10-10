import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/certification.dart';
import '../../providers/certification/certification_provider.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

const int _maxSizeBytes = 10 * 1024 * 1024;

class CertificationScreen extends ConsumerStatefulWidget {
  const CertificationScreen({super.key, this.stageId});

  final String? stageId;

  @override
  ConsumerState<CertificationScreen> createState() =>
      _CertificationScreenState();
}

class _CertificationScreenState extends ConsumerState<CertificationScreen> {
  final Set<String> _uploadingKinds = {};
  final Map<String, String> _errors = {};
  bool _submitting = false;

  @override
  Widget build(BuildContext context) {
    final stageId =
        widget.stageId ?? ref.watch(dashboardStatsProvider).value?.internship?.id;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Validation du stage'),
      ),
      body: stageId == null
          ? const EmptyState(
              icon: Icons.verified_outlined,
              title: 'Stage introuvable',
              message: 'Aucun stage actif pour déposer un dossier.',
            )
          : _buildBody(context, stageId),
    );
  }

  Widget _buildBody(BuildContext context, String stageId) {
    final stateAsync = ref.watch(certificationProvider(stageId));

    return stateAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => ErrorView(
        message: error.toString(),
        onRetry: () => ref.invalidate(certificationProvider(stageId)),
      ),
      data: (state) {
        final current = state ??
            const CertificationState(
              statut: 'NOT_SUBMITTED',
            );
        return RefreshIndicator(
          onRefresh: () =>
              ref.refresh(certificationProvider(stageId).future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _StatusCard(state: current),
              const SizedBox(height: 16),
              _DocumentSlot(
                title: 'Journal de stage',
                kind: 'JOURNAL',
                document: current.journal,
                uploading: _uploadingKinds.contains('JOURNAL'),
                error: _errors['JOURNAL'],
                enabled: current.canUpload,
                onPick: () => _pickAndUpload(stageId, 'JOURNAL'),
              ),
              const SizedBox(height: 12),
              _DocumentSlot(
                title: 'Rapport de stage STEG',
                kind: 'RAPPORT',
                document: current.rapport,
                uploading: _uploadingKinds.contains('RAPPORT'),
                error: _errors['RAPPORT'],
                enabled: current.canUpload,
                onPick: () => _pickAndUpload(stageId, 'RAPPORT'),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: current.canConfirm && !_submitting
                    ? () => _submit(stageId)
                    : null,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_outlined),
                label: Text(
                  current.isSubmitted
                      ? 'Dossier transmis — en relecture'
                      : 'Transmettre pour validation',
                ),
              ),
              if (current.decisions.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  'Historique',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                for (final decision in current.decisions)
                  _DecisionRow(decision: decision),
              ],
            ],
          ),
        );
      },
    );
  }

  Future<void> _pickAndUpload(String stageId, String kind) async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
    );
    final file = result?.files.single;
    if (file == null) return;
    final filePath = file.path;
    if (filePath == null || filePath.isEmpty) {
      _setError(kind, 'Fichier indisponible. Réessayez.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      _setError(kind, 'Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size <= 0) {
      _setError(kind, 'Fichier vide rejeté.');
      return;
    }
    if (file.size > _maxSizeBytes) {
      _setError(kind, 'Fichier trop volumineux. Taille maximale : 10 Mo.');
      return;
    }

    setState(() {
      _uploadingKinds.add(kind);
      _errors.remove(kind);
    });
    try {
      await ref.read(certificationServiceProvider).uploadDocument(
            stageId: stageId,
            kind: kind,
            filePath: filePath,
            fileName: file.name,
          );
      ref.invalidate(certificationProvider(stageId));
    } catch (error) {
      _setError(kind, error.toString());
    } finally {
      if (mounted) setState(() => _uploadingKinds.remove(kind));
    }
  }

  void _setError(String kind, String message) {
    if (mounted) setState(() => _errors[kind] = message);
  }

  Future<void> _submit(String stageId) async {
    setState(() => _submitting = true);
    try {
      await ref.read(certificationServiceProvider).submit(stageId: stageId);
      ref.invalidate(certificationProvider(stageId));
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(
            Icons.check_circle_outline,
            color: AppColors.success,
            size: 40,
          ),
          title: const Text('Dossier transmis'),
          content: const Text(
            'Vos documents ont été transmis à votre encadrant pour validation. '
            'Vous recevrez une notification concernant leur validation ou '
            'votre attestation de stage.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Compris'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(content: Text('Soumission échouée : $error')),
          );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.state});

  final CertificationState state;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final String label;
    final Color color;
    switch (state.statut) {
      case 'SUBMITTED':
        label = 'Transmis — en relecture';
        color = AppColors.info;
        break;
      case 'REDO_REQUESTED':
        label = 'Reprise demandée';
        color = AppColors.warning;
        break;
      case 'DENIED':
        label = 'Refusé';
        color = AppColors.danger;
        break;
      case 'VALIDATED':
        label = 'Validé';
        color = AppColors.success;
        break;
      case 'CERTIFICATE_GENERATED':
        label = 'Attestation générée';
        color = AppColors.success;
        break;
      default:
        label = 'Non soumis';
        color = AppColors.textSecondary;
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
            if (state.reason != null && state.reason!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Motif : ${state.reason}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (state.documentConcerne != null &&
                  state.documentConcerne!.isNotEmpty)
                Text(
                  'Document concerné : ${state.documentConcerne == 'JOURNAL' ? 'Journal de stage' : 'Rapport de stage'}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DocumentSlot extends StatelessWidget {
  const _DocumentSlot({
    required this.title,
    required this.kind,
    required this.document,
    required this.uploading,
    required this.error,
    required this.enabled,
    required this.onPick,
  });

  final String title;
  final String kind;
  final CertificationDocument? document;
  final bool uploading;
  final String? error;
  final bool enabled;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (document != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'v${document!.version}',
                      style: const TextStyle(
                        color: AppColors.success,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            if (document != null) ...[
              Row(
                children: [
                  const Icon(
                    Icons.picture_as_pdf_outlined,
                    size: 16,
                    color: AppColors.danger,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      document!.nom,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    document!.formattedTaille,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ] else
              Text(
                'Aucun fichier déposé.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            if (uploading)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: LinearProgressIndicator(),
              ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  error!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.danger,
                  ),
                ),
              ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: enabled && !uploading ? onPick : null,
              icon: Icon(
                document == null ? Icons.upload_file_outlined : Icons.sync_outlined,
                size: 16,
              ),
              label: Text(document == null ? 'Déposer le PDF' : 'Remplacer le PDF'),
            ),
          ],
        ),
      ),
    );
  }
}

class _DecisionRow extends StatelessWidget {
  const _DecisionRow({required this.decision});

  final CertificationDecision decision;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.history_outlined,
            size: 16,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${decision.fromStatut} → ${decision.toStatut}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (decision.reason != null && decision.reason!.isNotEmpty)
                  Text(
                    decision.reason!,
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
}
