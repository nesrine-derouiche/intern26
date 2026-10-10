import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/file_utils.dart';
import '../../models/certification.dart';
import '../../models/document_item.dart';
import '../../models/internship.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/certification/certification_provider.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/app_section_header.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/dashboard/dashboard_skeletons.dart';
import '../../widgets/dashboard/document_card.dart';
import 'pdf_preview_screen.dart';

class MyDocumentsScreen extends ConsumerStatefulWidget {
  const MyDocumentsScreen({super.key});

  @override
  ConsumerState<MyDocumentsScreen> createState() => _MyDocumentsScreenState();
}

class _MyDocumentsScreenState extends ConsumerState<MyDocumentsScreen> {
  static const List<String> _allowedExtensions = [
    'pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg',
  ];
  static const int _maxSizeBytes = 10 * 1024 * 1024;

  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value?.session?.user;
    final documentsAsync = ref.watch(myDocumentsProvider);
    final canUpload = user?.role == 'STAGIAIRE';

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Mes documents'),
        actions: [
          if (canUpload)
            IconButton(
              tooltip: 'Déposer un document',
              icon: const Icon(Icons.upload_file_outlined),
              onPressed: _busy ? null : () => _startUpload(context, user),
            ),
        ],
      ),
      floatingActionButton: canUpload
          ? FloatingActionButton.extended(
              onPressed: _busy ? null : () => _startUpload(context, user),
              icon: const Icon(Icons.upload_file_outlined),
              label: const Text('Déposer un document'),
            )
          : null,
      body: LoadingOverlay(
        loading: _busy,
        child: _buildBody(context, ref, user, documentsAsync),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    User? user,
    AsyncValue<List<DocumentItem>> documentsAsync,
  ) {
    if (user == null ||
        (user.role != 'STAGIAIRE' &&
            user.role != 'ENCADRANT' &&
            user.role != 'CHEF_DEPARTEMENT' &&
            user.role != 'ADMIN')) {
      return const EmptyState(
        icon: Icons.description_outlined,
        title: 'Documents indisponibles',
        message: 'Ce module n\'est pas accessible pour votre profil.',
      );
    }

    if (documentsAsync.isLoading && !documentsAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (context, index) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: DocumentCardSkeleton(),
        ),
      );
    }

    if (documentsAsync.hasError && !documentsAsync.hasValue) {
      return ErrorView(
        message: documentsAsync.error.toString(),
        onRetry: () => ref.refresh(myDocumentsProvider.future),
      );
    }

    final documents = documentsAsync.value ?? const <DocumentItem>[];
    final stats = ref.watch(dashboardStatsProvider).value;
    final internship = stats?.internship;
    final internshipId = internship?.id;
    final certificationAsync = internshipId == null
        ? const AsyncValue<CertificationState?>.data(null)
        : ref.watch(certificationProvider(internshipId));
    final certification = certificationAsync.value;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myDocumentsProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (documents.isEmpty && internshipId == null)
            const EmptyState(
              icon: Icons.description_outlined,
              title: 'Aucun document',
              message:
                  'Les documents déposés pour votre stage apparaîtront ici.',
            )
          else ...[
            if (internship != null) ...[
              const _SectionHeader(
                icon: Icons.auto_awesome_outlined,
                title: 'Documents officiels',
              ),
              const SizedBox(height: 8),
              for (final generated in _generatedDocuments(ref, internship))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _GeneratedPdfCard(
                    document: generated,
                    title: _generatedTitle(generated.type),
                    onPreview: () => _openGeneratedPdf(
                      context,
                      stageId: internship.id,
                      kind: _generatedKind(generated.type),
                      title: _generatedTitle(generated.type),
                      fileName: generated.nom,
                    ),
                    onDownload: () => _downloadGeneratedPdf(
                      context,
                      stageId: internship.id,
                      kind: _generatedKind(generated.type),
                      fileName: generated.nom,
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              if (certification?.hasAttestation ?? false) ...[
                const _SectionHeader(
                  icon: Icons.verified_outlined,
                  title: 'Attestation certifiée',
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _CertifiedAttestationCard(
                    fileName: certification?.attestationNom ??
                        'attestation_certification.pdf',
                    onPreview: () => _openCertifiedAttestation(context, internship),
                    onDownload: () =>
                        _downloadCertifiedAttestation(context, internship),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ],
            const _SectionHeader(
              icon: Icons.upload_file_outlined,
              title: 'Documents déposés',
            ),
            const SizedBox(height: 8),
            if (documents.isEmpty)
              EmptyState(
                icon: Icons.upload_file_outlined,
                title: 'Aucun dépôt',
                message: user.role == 'STAGIAIRE'
                    ? 'Déposez votre rapport, votre assurance ou votre CV.'
                    : 'Aucun document déposé pour ce stage.',
              )
            else
              for (final document in documents)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: DocumentCard(
                    document: document,
                    onPreview: () => _openDocumentPreview(context, document),
                    onDownload: () => _openDocumentDownload(context, document),
                    onDelete: (user.role == 'ENCADRANT' || user.role == 'ADMIN')
                        ? () => _confirmDelete(context, document)
                        : null,
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Future<void> _startUpload(BuildContext context, User? user) async {
    if (user?.role != 'STAGIAIRE') return;
    final type = await showModalBottomSheet<DocumentType>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(
                'Type de document',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
            for (final documentType in DocumentType.values)
              ListTile(
                leading: const Icon(Icons.description_outlined),
                title: Text(documentType.label),
                onTap: () => Navigator.of(context).pop(documentType),
              ),
          ],
        ),
      ),
    );
    if (type == null || !context.mounted) return;

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedExtensions,
    );
    if (result == null || !context.mounted) return;

    final file = result.files.single;
    final filePath = file.path;
    if (filePath == null) {
      _showSnack(context, 'Fichier indisponible. Réessayez.');
      return;
    }

    final fileSize = file.size;
    if (fileSize > _maxSizeBytes) {
      _showSnack(context, 'Fichier trop volumineux. Taille maximale : 10 Mo.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(myDocumentsProvider.notifier).upload(
            type: type.value,
            filePath: filePath,
            fileName: file.name,
          );
      if (context.mounted) {
        _showSnack(context, 'Document « ${file.name} » déposé avec succès.');
      }
    } catch (error) {
      if (context.mounted) {
        _showSnack(context, 'Échec du dépôt : $error');
      }
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openDocumentPreview(
    BuildContext context,
    DocumentItem document,
  ) async {
    setState(() => _busy = true);
    try {
      final bytes = await ref
          .read(downloadDocumentUseCaseProvider)
          .call(id: document.id, preview: true);
      if (!context.mounted) return;
      if (isPdfName(document.nom)) {
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) =>
                PdfPreviewScreen(title: document.nom, bytes: bytes),
          ),
        );
      } else {
        await openWithSystemViewer(bytes, document.nom);
      }
    } catch (error) {
      if (context.mounted) _showSnack(context, 'Aperçu indisponible : $error');
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openDocumentDownload(
    BuildContext context,
    DocumentItem document,
  ) async {
    setState(() => _busy = true);
    try {
      final bytes = await ref
          .read(downloadDocumentUseCaseProvider)
          .call(id: document.id);
      if (!context.mounted) return;
      await openWithSystemViewer(bytes, document.nom);
    } catch (error) {
      if (context.mounted) _showSnack(context, 'Téléchargement échoué : $error');
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openGeneratedPdf(
    BuildContext context, {
    required String stageId,
    required String kind,
    required String title,
    required String fileName,
  }) async {
    setState(() => _busy = true);
    try {
      final bytes = await ref
          .read(downloadStagePdfUseCaseProvider)
          .call(stageId: stageId, kind: kind);
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => PdfPreviewScreen(title: title, bytes: bytes),
        ),
      );
    } catch (error) {
      if (context.mounted) {
        _showSnack(context, 'Document indisponible : $error');
      }
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<void> _downloadGeneratedPdf(
    BuildContext context, {
    required String stageId,
    required String kind,
    required String fileName,
  }) async {
    setState(() => _busy = true);
    try {
      final bytes = await ref
          .read(downloadStagePdfUseCaseProvider)
          .call(stageId: stageId, kind: kind);
      if (!context.mounted) return;
      await openWithSystemViewer(bytes, fileName);
    } catch (error) {
      if (context.mounted) {
        _showSnack(context, 'Téléchargement échoué : $error');
      }
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<Uint8List> _fetchCertifiedAttestation(Internship internship) {
    return ref
        .read(certificationServiceProvider)
        .downloadAttestation(stageId: internship.id);
  }

  Future<void> _openCertifiedAttestation(
    BuildContext context,
    Internship internship,
  ) async {
    setState(() => _busy = true);
    try {
      final bytes = await _fetchCertifiedAttestation(internship);
      if (!context.mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => PdfPreviewScreen(
            title: 'Attestation certifiée',
            bytes: bytes,
          ),
        ),
      );
    } catch (error) {
      if (context.mounted) {
        _showSnack(context, 'Attestation indisponible : $error');
      }
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  Future<void> _downloadCertifiedAttestation(
    BuildContext context,
    Internship internship,
  ) async {
    setState(() => _busy = true);
    try {
      final bytes = await _fetchCertifiedAttestation(internship);
      final name = ref
              .read(certificationProvider(internship.id))
              .value
              ?.attestationNom ??
          'attestation_certification.pdf';
      if (!context.mounted) return;
      await openWithSystemViewer(bytes, name);
    } catch (error) {
      if (context.mounted) {
        _showSnack(context, 'Téléchargement échoué : $error');
      }
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  List<DocumentItem> _generatedDocuments(WidgetRef ref, Internship internship) {
    return ref.read(documentServiceProvider).generatedDocumentsForStage(
          stageId: internship.id,
          generatedAt: internship.dateDebut,
        );
  }

  String _generatedKind(String type) {
    return switch (type) {
      'CONVENTION' => 'convention',
      'ATTESTATION' => 'attestation',
      'EVALUATION' => 'evaluation',
      _ => 'convention',
    };
  }

  String _generatedTitle(String type) {
    return switch (type) {
      'CONVENTION' => 'Convention de stage',
      'ATTESTATION' => 'Attestation de stage',
      'EVALUATION' => "Fiche d'évaluation",
      _ => 'Document généré',
    };
  }

  Future<void> _confirmDelete(
    BuildContext context,
    DocumentItem document,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer le document'),
        content: Text(
          'Le document « ${document.nom} » sera définitivement supprimé.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    setState(() => _busy = true);
    try {
      await ref.read(myDocumentsProvider.notifier).delete(document.id);
      if (context.mounted) _showSnack(context, 'Document supprimé.');
    } catch (error) {
      if (context.mounted) _showSnack(context, 'Suppression échouée : $error');
    } finally {
      if (context.mounted) setState(() => _busy = false);
    }
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return AppSectionHeader(icon: icon, title: title);
  }
}

class _CertifiedAttestationCard extends StatelessWidget {
  const _CertifiedAttestationCard({
    required this.fileName,
    required this.onPreview,
    required this.onDownload,
  });

  final String fileName;
  final VoidCallback onPreview;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.workspace_premium_outlined,
              size: 22,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Attestation de stage certifiée',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Validée par votre encadrant',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Aperçu',
            onPressed: onPreview,
            icon: const Icon(Icons.visibility_outlined),
          ),
          IconButton(
            tooltip: 'Télécharger',
            onPressed: onDownload,
            icon: const Icon(Icons.download_outlined),
          ),
        ],
      ),
    );
  }
}

class _GeneratedPdfCard extends StatelessWidget {
  const _GeneratedPdfCard({
    required this.document,
    required this.title,
    required this.onPreview,
    required this.onDownload,
  });

  final DocumentItem document;
  final String title;
  final VoidCallback onPreview;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitle = [
      document.typeLabel,
      if (document.dateDepot != null) formatDateFr(document.dateDepot),
      if (document.templateVersion != null) 'v${document.templateVersion}',
    ].join(' · ');
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.picture_as_pdf_outlined,
              size: 22,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Télécharger',
            icon: const Icon(Icons.download_outlined),
            onPressed: onDownload,
          ),
          IconButton(
            tooltip: 'Aperçu',
            icon: const Icon(Icons.visibility_outlined),
            onPressed: onPreview,
          ),
        ],
      ),
    );
  }
}
