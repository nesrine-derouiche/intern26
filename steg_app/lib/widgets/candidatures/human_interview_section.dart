import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../models/human_interview.dart';
import '../common/app_card.dart';

/// Section « Entretien humain » affichée sur le détail d'une candidature.
///
/// Le lien de réunion provient exclusivement du backend ; le client ne fait
/// que l'ouvrir via le lanceur d'applications externe.
class HumanInterviewSection extends StatelessWidget {
  const HumanInterviewSection({super.key, required this.interview});

  final HumanInterview interview;

  @override
  Widget build(BuildContext context) {
    if (interview.isCancelled) return _buildCancelled(context);
    return _buildScheduled(context);
  }

  Widget _buildScheduled(BuildContext context) {
    final theme = Theme.of(context);
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(
            context,
            icon: Icons.video_camera_back_outlined,
            color: AppColors.primary,
            title: 'Entretien humain',
            pillLabel: 'Entretien programmé',
            pillColor: AppColors.success,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _InfoTile(
                  icon: Icons.event_outlined,
                  label: 'Date',
                  value: interview.dateLabel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _InfoTile(
                  icon: Icons.schedule,
                  label: 'Heure',
                  value: interview.timeLabel,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _InfoTile(
                  icon: Icons.timer_outlined,
                  label: 'Durée',
                  value: interview.durationLabel,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceTone,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.person_outline,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Intervieweur',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        interview.interviewer.isEmpty
                            ? 'Non communiqué'
                            : interview.interviewer,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (interview.interviewerEmail.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          interview.interviewerEmail,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (interview.hasMeetingLink) ...[
            const SizedBox(height: 14),
            Text(
              'Merci de vous connecter quelques minutes avant l\'heure prévue.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _join(context),
                icon: const Icon(Icons.videocam, size: 18),
                label: const Text('Rejoindre la visio'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCancelled(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(
            context,
            icon: Icons.event_busy_outlined,
            color: AppColors.danger,
            title: 'Entretien humain',
            pillLabel: 'Entretien annulé',
            pillColor: AppColors.danger,
          ),
          const SizedBox(height: 10),
          Text(
            'Votre entretien humain a été annulé. Vous serez informé d\'une '
            'éventuelle nouvelle planification.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
          ),
        ],
      ),
    );
  }

  Widget _header(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required String pillLabel,
    required Color pillColor,
  }) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            gradient: AppColors.brandGradient,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 22, color: Colors.white),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: pillColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            pillLabel,
            style: TextStyle(
              color: pillColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _join(BuildContext context) async {
    final uri = Uri.tryParse(interview.lienVisio.trim());
    if (uri == null || !interview.hasMeetingLink) return;

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Impossible d\'ouvrir le lien de la visioconférence.'),
        ),
      );
    }
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        boxShadow: AppColors.softShadowSmall,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(height: 6),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
