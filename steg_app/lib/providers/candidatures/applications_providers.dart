import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/application_status.dart';
import '../../models/candidature.dart';
import '../offres/offres_providers.dart';

class ApplicationSection {
  const ApplicationSection({required this.status, required this.items});

  final ApplicationStatut status;
  final List<Candidature> items;
}

final applicationsSectionsProvider = Provider<List<ApplicationSection>>((ref) {
  final candidatures = ref.watch(myCandidaturesProvider).value ?? const <Candidature>[];
  final groups = <String, List<Candidature>>{};
  for (final candidature in candidatures) {
    groups.putIfAbsent(candidature.statut, () => []).add(candidature);
  }

  return [
    for (final status in ApplicationStatut.values)
      ApplicationSection(
        status: status,
        items: groups[status.value] ?? const [],
      ),
  ];
});
