import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_exception.dart';
import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../models/document_onboarding.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/onboarding/document_onboarding_provider.dart';
import '../../providers/onboarding/internship_access_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/onboarding/document_status_card.dart';
import 'document_upload_validation.dart';

class DocumentOnboardingScreen extends ConsumerStatefulWidget {
  const DocumentOnboardingScreen({super.key});

  @override
  ConsumerState<DocumentOnboardingScreen> createState() =>
      _DocumentOnboardingScreenState();
}

class _DocumentOnboardingScreenState
    extends ConsumerState<DocumentOnboardingScreen> {
  final Set<String> _busyTypes = {};

  @override
  Widget build(BuildContext context) {
    final onboardingAsync = ref.watch(documentOnboardingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Compléter votre dossier'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: onboardingAsync.when(
        data: (onboarding) => onboarding == null
            ? const ErrorView(message: 'Aucun dossier en cours.')
            : _buildContent(context, onboarding),
        loading: () => const Center(
          child: CircularProgressIndicator(),
        ),
        error: (error, stackTrace) => ErrorView(
          message: 'Impossible de charger votre dossier.',
          onRetry: _retryLoading,
        ),
      ),
    );
  }

  /// Rejoue le chargement du dossier puis la vérification de l'accès.
  Future<void> _retryLoading() async {
    await ref.read(documentOnboardingProvider.notifier).refresh();
    await ref.read(internshipAccessProvider.notifier).refresh();
  }

  Widget _buildContent(BuildContext context, DocumentOnboarding onboarding) {
    final theme = Theme.of(context);
    final uploadUi = ref.watch(onboardingUploadUiProvider);
    final accessState = ref.watch(internshipAccessProvider);
    final access = accessState.value;
    final cards = <Widget>[];

    for (final type in OnboardingDocumentType.values) {
      if (!onboarding.requiredTypes.contains(type.value)) continue;
      final document = onboarding.documentOfType(type.value) ??
          OnboardingDocument(type: type.value, status: OnboardingDocumentStatus.manquant);
      cards.add(
        DocumentStatusCard(
          type: type,
          document: document,
          busy: _busyTypes.contains(type.value),
          onUpload: () => _startUpload(context, onboarding.candidatureId, type),
        ),
      );
      cards.add(const SizedBox(height: 12));
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bienvenue dans STEG Internship',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Avant de commencer votre stage, veuillez compléter votre '
                  'dossier.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: onboarding.total == 0
                              ? 0
                              : onboarding.submitted / onboarding.total,
                          minHeight: 8,
                          backgroundColor:
                              Colors.white.withValues(alpha: 0.25),
                          valueColor:
                              const AlwaysStoppedAnimation(Colors.white),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '${onboarding.submitted}/${onboarding.total} '
                      '${onboarding.submitted == 1 ? 'document' : 'documents'}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (uploadUi.hasError) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppColors.danger),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      uploadUi.errorMessage ??
                          'Le document n\'a pas pu être envoyé.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _busyTypes.isEmpty
                        ? () => _retryUpload(context)
                        : null,
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (accessState.hasError) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppColors.danger),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Impossible de vérifier votre dossier.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        ref.read(internshipAccessProvider.notifier).refresh(),
                    child: const Text('Réessayer'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (access != null && access.accessGranted && onboarding.isComplete) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.35),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_outlined,
                        color: AppColors.success,
                        size: 26,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Votre dossier est complet.',
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Vos documents ont été vérifiés et votre accès au stage '
                    'est activé.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.success,
                      ),
                      onPressed: () => context.go(RoutePaths.home),
                      icon: const Icon(Icons.arrow_forward, size: 18),
                      label: const Text('Accéder à mon espace'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ] else if (access != null &&
              !access.accessGranted &&
              onboarding.isComplete) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.info.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.hourglass_top_outlined,
                    color: AppColors.info,
                    size: 26,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Vos documents sont en cours de vérification.',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          Text(
            'Documents requis',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          ...cards,
        ],
      ),
    );
  }

  Future<void> _startUpload(
    BuildContext context,
    String candidatureId,
    OnboardingDocumentType type,
  ) async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: documentUploadAllowedExtensions,
    );
    if (result == null || !context.mounted) return;

    final file = result.files.single;
    final filePath = file.path;
    if (filePath == null) {
      _showSnack(context, 'Fichier indisponible. Réessayez.');
      return;
    }
    final validationError = validateDocumentFile(
      fileName: file.name,
      sizeBytes: file.size,
    );
    if (validationError != null) {
      _showSnack(context, validationError);
      return;
    }

    final attempt = OnboardingUploadAttempt(
      candidatureId: candidatureId,
      type: type.value,
      filePath: filePath,
      fileName: file.name,
    );
    await _performUpload(context, attempt);
  }

  Future<void> _retryUpload(BuildContext context) async {
    final attempt = ref.read(onboardingUploadUiProvider).pendingAttempt;
    if (attempt == null) return;
    await _performUpload(context, attempt);
  }

  Future<void> _performUpload(
    BuildContext context,
    OnboardingUploadAttempt attempt,
  ) async {
    setState(() => _busyTypes.add(attempt.type));
    try {
      await ref
          .read(documentOnboardingProvider.notifier)
          .uploadDocument(
            candidatureId: attempt.candidatureId,
            type: attempt.type,
            filePath: attempt.filePath,
            fileName: attempt.fileName,
          );
      ref.read(onboardingUploadUiProvider.notifier).clearError();
      if (context.mounted) {
        _showSnack(context, 'Document déposé. Il sera vérifié sous peu.');
      }
    } catch (error) {
      ref
          .read(onboardingUploadUiProvider.notifier)
          .reportError(_errorMessage(error), attempt);
    } finally {
      if (mounted) setState(() => _busyTypes.remove(attempt.type));
    }
  }

  /// Message d'erreur réel renvoyé par le backend (ou message générique).
  String _errorMessage(Object error) {
    if (error is ApiException && error.message.isNotEmpty) return error.message;
    return 'Le document n\'a pas pu être envoyé.';
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }
}
