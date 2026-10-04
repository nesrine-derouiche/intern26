import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/date_utils.dart';
import '../../models/offre.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/offres/offres_providers.dart';
import '../../widgets/common/app_button.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/offres/offre_info_tile.dart';
import '../../widgets/offres/offre_statut_badge.dart';

class OffreDetailsScreen extends ConsumerStatefulWidget {
  const OffreDetailsScreen({super.key, required this.offreId, this.offre});

  final String offreId;
  final Offre? offre;

  @override
  ConsumerState<OffreDetailsScreen> createState() => _OffreDetailsScreenState();
}

class _OffreDetailsScreenState extends ConsumerState<OffreDetailsScreen> {
  bool _submitting = false;

  Future<void> _apply(Offre offre, User user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirmer la candidature'),
        content: Text(
          'Voulez-vous postuler à l\'offre « ${offre.titre} » ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirmer'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _submitting = true);
    try {
      await ref
          .read(applyToOffreUseCaseProvider)
          .call(stagiaireId: user.id, offreId: offre.id);
      ref.invalidate(myCandidaturesProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Candidature envoyée avec succès.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Une erreur est survenue. Veuillez réessayer.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.value?.session?.user;
    final appliedIds = ref.watch(appliedOffreIdsProvider);
    final offersAsync = ref.watch(offresListProvider);

    final offre = widget.offre ?? _findOffer(offersAsync.value, widget.offreId);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Détail de l\'offre'),
      ),
      body: offre == null
          ? _buildMissing(offersAsync)
          : _buildDetails(offre, user, appliedIds),
      bottomNavigationBar: offre == null
          ? null
          : _buildApplyBar(offre, user, appliedIds),
    );
  }

  Offre? _findOffer(List<Offre>? offers, String id) {
    if (offers == null) return null;
    for (final offre in offers) {
      if (offre.id == id) return offre;
    }
    return null;
  }

  Widget _buildMissing(AsyncValue<List<Offre>> offersAsync) {
    if (offersAsync.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    return const EmptyState(
      icon: Icons.work_off_outlined,
      title: 'Offre introuvable',
      message: 'Cette offre n\'est plus disponible.',
    );
  }

  Widget _buildDetails(Offre offre, User? user, Set<String> appliedIds) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
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
                    child: Hero(
                      tag: 'offre-titre-${offre.id}',
                      child: Material(
                        color: Colors.transparent,
                        child: Text(
                          offre.titre,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            height: 1.25,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      OffreStatutBadge.label(offre.statut),
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
                      offre.departementNom.isEmpty
                          ? 'Sans département'
                          : offre.departementNom,
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
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Description',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          offre.description.isEmpty
              ? 'Aucune description fournie.'
              : offre.description,
          style: theme.textTheme.bodyMedium?.copyWith(height: 1.55),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: OffreInfoTile(
                icon: Icons.schedule,
                label: 'Durée',
                value: offre.dureeLabel,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OffreInfoTile(
                icon: Icons.group_outlined,
                label: 'Places',
                value: '${offre.nombrePlaces}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OffreInfoTile(
                icon: Icons.event_outlined,
                label: 'Date limite',
                value: formatDateFr(offre.dateLimite),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OffreInfoTile(
                icon: Icons.how_to_reg_outlined,
                label: 'Candidatures',
                value: '${offre.nbCandidatures}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text(
          'Compétences demandées',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        if (offre.competences.isEmpty)
          Text(
            'Aucune compétence spécifiée.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppColors.textSecondary,
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final competence in offre.competences)
                Chip(
                  label: Text(competence),
                  visualDensity: VisualDensity.compact,
                  backgroundColor:
                      Theme.of(context).colorScheme.surfaceContainerLow,
                  side: BorderSide.none,
                  avatar: const Icon(
                    Icons.check_circle_outline,
                    size: 16,
                    color: AppColors.success,
                  ),
                ),
            ],
          ),
      ],
    );
  }

  Widget? _buildApplyBar(Offre offre, User? user, Set<String> appliedIds) {
    final isStagiaire = user?.role == 'STAGIAIRE';
    if (!isStagiaire) return null;

    final alreadyApplied = appliedIds.contains(offre.id);
    final canApply = offre.estOuverte && offre.nombrePlaces > 0 && !alreadyApplied;

    final String label;
    if (alreadyApplied) {
      label = 'Déjà postulé';
    } else if (canApply) {
      label = 'Postuler à cette offre';
    } else if (!offre.estOuverte) {
      label = 'Offre fermée';
    } else if (offre.nombrePlaces <= 0) {
      label = 'Plus de places disponibles';
    } else {
      label = 'Candidature indisponible';
    }

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: AppButton(
          label: label,
          loading: _submitting,
          onPressed: canApply && !_submitting ? () => _apply(offre, user!) : null,
        ),
      ),
    );
  }
}
