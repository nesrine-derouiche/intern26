import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../models/pointage.dart';
import '../../providers/pointage/pointage_providers.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';

class HistoriquePresencesScreen extends ConsumerStatefulWidget {
  const HistoriquePresencesScreen({super.key});

  @override
  ConsumerState<HistoriquePresencesScreen> createState() =>
      _HistoriquePresencesScreenState();
}

class _HistoriquePresencesScreenState
    extends ConsumerState<HistoriquePresencesScreen> {
  String? _statutFilter;

  @override
  Widget build(BuildContext context) {
    final presencesAsync = ref.watch(mesPresencesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Historique des présences'),
      ),
      body: presencesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: AppColors.danger),
              const SizedBox(height: 16),
              Text(e.toString(), textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.invalidate(mesPresencesProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (presences) {
          final filtered = _statutFilter != null
              ? presences.where((p) => p.statut.value == _statutFilter).toList()
              : presences;

          if (presences.isEmpty) {
            return const EmptyState(
              icon: Icons.event_available_outlined,
              title: 'Aucune présence',
              message: 'Vos pointages apparaîtront ici.',
            );
          }

          return Column(
            children: [
              _buildFilters(presences),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () =>
                      ref.read(mesPresencesProvider.notifier).refresh(),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                    itemCount: filtered.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, index) =>
                        _buildPointageCard(context, filtered[index]),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFilters(List<Pointage> presences) {
    final stats = _computeStats(presences);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          _buildFilterChip('Tous', null, stats['total'] ?? 0),
          const SizedBox(width: 8),
          _buildFilterChip('Présent', 'PRESENT', stats['PRESENT'] ?? 0),
          const SizedBox(width: 8),
          _buildFilterChip('Retard', 'RETARD', stats['RETARD'] ?? 0),
          const SizedBox(width: 8),
          _buildFilterChip('Absent', 'ABSENT', stats['ABSENT'] ?? 0),
        ],
      ),
    );
  }

  Map<String, int> _computeStats(List<Pointage> presences) {
    final stats = <String, int>{'total': presences.length};
    for (final p in presences) {
      stats[p.statut.value] = (stats[p.statut.value] ?? 0) + 1;
    }
    return stats;
  }

  Widget _buildFilterChip(String label, String? value, int count) {
    final isSelected = _statutFilter == value;
    return FilterChip(
      label: Text('$label ($count)'),
      selected: isSelected,
      onSelected: (_) {
        setState(() {
          _statutFilter = isSelected ? null : value;
        });
      },
      selectedColor: AppColors.primaryTint,
      checkmarkColor: AppColors.primary,
      labelStyle: TextStyle(
        color: isSelected ? AppColors.primary : AppColors.textSecondary,
        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        fontSize: 13,
      ),
    );
  }

  Widget _buildPointageCard(BuildContext context, Pointage pointage) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _statusColor(pointage.statut).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _statusIcon(pointage.statut),
                  color: _statusColor(pointage.statut),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pointage.dateLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    Text(
                      pointage.statutLabel,
                      style: TextStyle(
                        fontSize: 12,
                        color: _statusColor(pointage.statut),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (pointage.retardMinutes > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    pointage.retardLabel,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.danger,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildTimeInfo(
                context,
                icon: Icons.login,
                label: 'Entrée',
                value: pointage.heureEntreeLabel,
              ),
              const SizedBox(width: 16),
              _buildTimeInfo(
                context,
                icon: Icons.logout,
                label: 'Sortie',
                value: pointage.hasExit ? pointage.heureSortieLabel : '—',
              ),
              const SizedBox(width: 16),
              _buildTimeInfo(
                context,
                icon: Icons.timer_outlined,
                label: 'Durée',
                value: pointage.hasEntry ? pointage.dureeLabel : '—',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimeInfo(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.textTertiary),
          const SizedBox(width: 4),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textTertiary,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _statusColor(PointageStatut statut) {
    return switch (statut) {
      PointageStatut.present => AppColors.success,
      PointageStatut.retard => AppColors.warning,
      PointageStatut.absent => AppColors.danger,
    };
  }

  IconData _statusIcon(PointageStatut statut) {
    return switch (statut) {
      PointageStatut.present => Icons.check_circle_outline,
      PointageStatut.retard => Icons.warning_amber_rounded,
      PointageStatut.absent => Icons.cancel_outlined,
    };
  }
}
