import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/pointage.dart';
import '../../providers/pointage/pointage_providers.dart';
import '../../widgets/common/app_card.dart';

class PointageScreen extends ConsumerWidget {
  const PointageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pointageAsync = ref.watch(pointageProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Présences'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => context.push(RoutePaths.historiquePresences),
          ),
        ],
      ),
      body: pointageAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 48, color: AppColors.danger),
                const SizedBox(height: 16),
                Text(e.toString(), textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(pointageProvider),
                  child: const Text('Réessayer'),
                ),
              ],
            ),
          ),
        ),
        data: (state) => RefreshIndicator(
          onRefresh: () => ref.read(pointageProvider.notifier).refresh(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildTodayCard(context, ref, state),
                const SizedBox(height: 20),
                _buildHoraireCard(state.horaire),
                const SizedBox(height: 20),
                _buildQuickActions(context, ref, state),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTodayCard(BuildContext context, WidgetRef ref, PointageState state) {
    final today = DateTime.now();
    final dateLabel = formatDateFr(today);
    final pointage = state.todayPointage;

    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _statusColor(pointage?.statut).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  _statusIcon(pointage?.statut),
                  color: _statusColor(pointage?.statut),
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Aujourd'hui",
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dateLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
              if (pointage != null)
                _buildStatusBadge(pointage.statut),
            ],
          ),
          const SizedBox(height: 20),
          if (pointage == null) ...[
            _buildNoEntryPlaceholder(context),
          ] else ...[
            _buildPointageDetails(context, pointage),
          ],
        ],
      ),
    );
  }

  Widget _buildNoEntryPlaceholder(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surfaceTone,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.fingerprint, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 12),
          Text(
            'Aucun pointage enregistré',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Pointez votre entrée pour commencer la journée',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textTertiary,
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildPointageDetails(BuildContext context, Pointage pointage) {
    return Column(
      children: [
        _buildDetailRow(
          context,
          icon: Icons.login,
          label: 'Entrée',
          value: pointage.heureEntreeLabel,
          color: AppColors.success,
        ),
        const SizedBox(height: 10),
        _buildDetailRow(
          context,
          icon: Icons.logout,
          label: 'Sortie',
          value: pointage.hasExit ? pointage.heureSortieLabel : '—',
          color: pointage.hasExit ? AppColors.info : AppColors.textTertiary,
        ),
        const SizedBox(height: 10),
        _buildDetailRow(
          context,
          icon: Icons.timer_outlined,
          label: 'Durée',
          value: pointage.hasEntry ? pointage.dureeLabel : '—',
          color: AppColors.primary,
        ),
        if (pointage.retardMinutes > 0) ...[
          const SizedBox(height: 10),
          _buildDetailRow(
            context,
            icon: Icons.warning_amber_rounded,
            label: 'Retard',
            value: pointage.retardLabel,
            color: AppColors.danger,
          ),
        ],
      ],
    );
  }

  Widget _buildDetailRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 10),
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
              ),
        ),
        const Spacer(),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: color,
              ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(PointageStatut statut) {
    final color = _statusColor(statut);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        statut.label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildHoraireCard(Horaire horaire) {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.violet.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.schedule,
              color: AppColors.violet,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Horaire prévu',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  horaire.horaireLabel,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  horaire.pauseLabel,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context, WidgetRef ref, PointageState state) {
    if (state.isLoadingAction) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(24),
        child: CircularProgressIndicator(),
      ));
    }

    if (state.isJourneeTerminee) {
      return AppCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.check_circle, size: 48, color: AppColors.success),
            const SizedBox(height: 12),
            Text(
              'Journée terminée',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.success,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              '${state.todayPointage?.dureeLabel} travaillées',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        if (!state.hasEntry)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _confirmAction(
                context,
                title: 'Pointer votre entrée ?',
                onConfirm: () => ref.read(pointageProvider.notifier).pointerEntree(),
              ),
              icon: const Icon(Icons.login),
              label: const Text('Pointer mon entrée'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: AppColors.success,
              ),
            ),
          ),
        if (state.hasEntry && !state.hasExit)
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _confirmAction(
                context,
                title: 'Pointer votre sortie ?',
                onConfirm: () => ref.read(pointageProvider.notifier).pointerSortie(),
              ),
              icon: const Icon(Icons.logout),
              label: const Text('Pointer ma sortie'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: AppColors.danger,
              ),
            ),
          ),
      ],
    );
  }

  void _confirmAction(
    BuildContext context, {
    required String title,
    required VoidCallback onConfirm,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: const Text('Confirmez cette action de pointage.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              onConfirm();
            },
            child: const Text('Confirmer'),
          ),
        ],
      ),
    );
  }

  Color _statusColor(PointageStatut? statut) {
    return switch (statut) {
      PointageStatut.present => AppColors.success,
      PointageStatut.retard => AppColors.warning,
      PointageStatut.absent => AppColors.danger,
      null => AppColors.textTertiary,
    };
  }

  IconData _statusIcon(PointageStatut? statut) {
    return switch (statut) {
      PointageStatut.present => Icons.check_circle_outline,
      PointageStatut.retard => Icons.warning_amber_rounded,
      PointageStatut.absent => Icons.cancel_outlined,
      null => Icons.fingerprint,
    };
  }
}
