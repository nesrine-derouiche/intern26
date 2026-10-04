import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/offre.dart';
import '../../providers/offres/offres_providers.dart';
import 'offre_statut_badge.dart';

class OffreFilterSheet extends ConsumerWidget {
  const OffreFilterSheet({super.key});

  static const List<String> statutOptions = [
    'OUVERTE',
    'FERMEE',
    'EXPIREE',
    'POURVUE',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(offresUiProvider);
    final offers = ref.watch(offresListProvider).value ?? const <Offre>[];
    final departments = offers
        .map((offre) => offre.departementNom)
        .where((name) => name.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    final notifier = ref.read(offresUiProvider.notifier);
    final theme = Theme.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Filtrer les offres',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 20),
            Text(
              'Statut',
              style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Tous'),
                  selected: filters.statut == null,
                  onSelected: (_) => notifier.setStatut(null),
                ),
                for (final statut in statutOptions)
                  ChoiceChip(
                    label: Text(OffreStatutBadge.label(statut)),
                    selected: filters.statut == statut,
                    onSelected: (_) => notifier.setStatut(statut),
                  ),
              ],
            ),
            if (departments.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Département',
                style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Tous'),
                    selected: filters.departement == null,
                    onSelected: (_) => notifier.setDepartement(null),
                  ),
                  for (final department in departments)
                    ChoiceChip(
                      label: Text(department),
                      selected: filters.departement == department,
                      onSelected: (_) => notifier.setDepartement(department),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      notifier.reset();
                      Navigator.pop(context);
                    },
                    child: const Text('Réinitialiser'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Voir les résultats'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
