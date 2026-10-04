import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/application_status.dart';
import '../../models/candidature.dart';
import '../../models/human_interview.dart';
import '../../providers/offres/offres_providers.dart';
import '../../widgets/candidatures/human_interview_section.dart';
import '../../widgets/common/error_view.dart';

class ApplicationDetailsScreen extends ConsumerWidget {
  const ApplicationDetailsScreen({
    super.key,
    required this.candidatureId,
    this.candidature,
  });

  final String candidatureId;
  final Candidature? candidature;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final interviewAsync = ref.watch(humanInterviewProvider(candidatureId));
    final candidature = this.candidature;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Détail de la candidature'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (candidature != null) ...[
            _buildHeader(context, candidature),
            const SizedBox(height: 16),
          ],
          _buildInterviewSection(context, ref, interviewAsync),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Candidature candidature) {
    final status = ApplicationStatut.fromValue(candidature.statut);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  candidature.offreTitre.isEmpty
                      ? 'Offre sans titre'
                      : candidature.offreTitre,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    height: 1.25,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  status == null
                      ? candidature.statut
                      : status.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.business_outlined,
                size: 16,
                color: Colors.white70,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  candidature.departementNom.isEmpty
                      ? 'Sans département'
                      : candidature.departementNom,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.event_outlined,
                size: 16,
                color: Colors.white70,
              ),
              const SizedBox(width: 6),
              Text(
                'Postulé le ${formatDateFr(candidature.dateCandidature)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInterviewSection(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<HumanInterview?> interviewAsync,
  ) {
    if (interviewAsync.isLoading && !interviewAsync.hasValue) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (interviewAsync.hasError && !interviewAsync.hasValue) {
      return ErrorView(
        message: interviewAsync.error.toString(),
        onRetry: () => ref.refresh(humanInterviewProvider(candidatureId).future),
      );
    }

    final interview = interviewAsync.value;
    if (interview == null) return const SizedBox.shrink();

    return HumanInterviewSection(interview: interview);
  }
}
