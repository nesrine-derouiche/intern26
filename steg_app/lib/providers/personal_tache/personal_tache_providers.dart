import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/personal_tache.dart';
import '../../providers/core/api_client_provider.dart';
import '../../services/personal_tache_service.dart';

final personalTacheServiceProvider = Provider<PersonalTacheService>(
  (ref) => PersonalTacheService(ref.watch(dioProvider)),
);

final personalTachesProvider =
    AsyncNotifierProvider<PersonalTachesNotifier, List<PersonalTache>>(
  PersonalTachesNotifier.new,
);

class PersonalTachesNotifier extends AsyncNotifier<List<PersonalTache>> {
  @override
  Future<List<PersonalTache>> build() {
    return ref.read(personalTacheServiceProvider).list();
  }

  Future<PersonalTache> create({
    required String titre,
    String? description,
    String? priorite,
    String? dateEcheance,
  }) async {
    final service = ref.read(personalTacheServiceProvider);
    final task = await service.create(
      titre: titre,
      description: description,
      priorite: priorite,
      dateEcheance: dateEcheance,
    );
    ref.invalidateSelf();
    return task;
  }

  Future<void> updateTask(String id, {
    String? titre,
    String? description,
    String? priorite,
    String? dateEcheance,
  }) async {
    final service = ref.read(personalTacheServiceProvider);
    await service.update(id,
      titre: titre,
      description: description,
      priorite: priorite,
      dateEcheance: dateEcheance,
    );
    ref.invalidateSelf();
  }

  Future<void> delete(String id) async {
    final service = ref.read(personalTacheServiceProvider);
    await service.delete(id);
    ref.invalidateSelf();
  }

  Future<void> moveTask(String id, {
    required String statut,
    required int position,
  }) async {
    final previous = state.value;
    final service = ref.read(personalTacheServiceProvider);

    // Optimistic update
    if (previous != null) {
      final updated = previous.map((t) {
        if (t.id == id) return t.copyWith(statut: statut, position: position);
        return t;
      }).toList();
      state = AsyncData(updated);
    }

    try {
      await service.move(id, statut: statut, position: position);
      ref.invalidateSelf();
    } catch (e) {
      // Rollback on error
      if (previous != null) {
        state = AsyncData(previous);
      }
      rethrow;
    }
  }
}
