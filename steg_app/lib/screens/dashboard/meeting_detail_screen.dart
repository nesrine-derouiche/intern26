import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/reunion.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/status_pill.dart';

class MeetingDetailScreen extends StatelessWidget {
  const MeetingDetailScreen({super.key, required this.reunion});

  final Reunion reunion;

  bool get _hasVisio =>
      reunion.lienVisio != null && reunion.lienVisio!.isNotEmpty;

  bool get _hasSalle =>
      reunion.salle != null && reunion.salle!.isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final upcoming = reunion.estAVenir;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Détail de la réunion'),
        actions: [
          if (upcoming)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: StatusPill(
                  label: 'À venir',
                  color: AppColors.success,
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _HeroCard(reunion: reunion),
          const SizedBox(height: 16),
          _InfoRow(
            icon: Icons.calendar_today_outlined,
            label: 'Date',
            value: formatDateFr(reunion.date),
          ),
          const SizedBox(height: 12),
          _InfoRow(
            icon: Icons.schedule_outlined,
            label: 'Heure',
            value: reunion.heureLabel,
          ),
          const SizedBox(height: 12),
          _InfoRow(
            icon: _hasVisio ? Icons.videocam_outlined : Icons.meeting_room_outlined,
            label: 'Lieu',
            value: _hasVisio
                ? (_hasSalle ? '${reunion.salle} (Visio)' : 'Visio en ligne')
                : (_hasSalle ? 'Salle ${reunion.salle}' : 'Salle à confirmer'),
          ),
          if (reunion.encadrantFullName.isNotEmpty) ...[
            const SizedBox(height: 12),
            _InfoRow(
              icon: Icons.person_outline,
              label: 'Encadrant',
              value: reunion.encadrantFullName,
            ),
          ],
          if (_hasVisio && upcoming) ...[
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _joinVideo,
              icon: const Icon(Icons.videocam, size: 20),
              label: const Text('Rejoindre la visio'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.success,
                minimumSize: const Size(double.infinity, 52),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _joinVideo() async {
    final uri = Uri.parse(reunion.lienVisio!);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.reunion});

  final Reunion reunion;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasVisio =
        reunion.lienVisio != null && reunion.lienVisio!.isNotEmpty;

    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  hasVisio ? Icons.videocam_outlined : Icons.event_outlined,
                  size: 22,
                  color: AppColors.success,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reunion.sujet.isNotEmpty ? reunion.sujet : 'Réunion',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${formatDateFr(reunion.date)} à ${reunion.heureLabel}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              StatusPill(
                label: reunion.estAVenir ? 'À venir' : 'Passée',
                color: reunion.estAVenir
                    ? AppColors.success
                    : AppColors.textSecondary,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
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
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: AppColors.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
