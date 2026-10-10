import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/note.dart';
import '../../services/note_service.dart';
import '../core/api_client_provider.dart';

final noteServiceProvider = Provider<NoteService>(
  (ref) => NoteService(ref.watch(dioProvider)),
);

final notesProvider =
    AsyncNotifierProvider<NotesNotifier, List<Note>>(NotesNotifier.new);

class NotesNotifier extends AsyncNotifier<List<Note>> {
  @override
  Future<List<Note>> build() {
    return ref.read(noteServiceProvider).list();
  }

  Future<Note> createNote({
    required String titre,
    required String contenu,
    required String clientKey,
  }) async {
    final note = await ref.read(noteServiceProvider).create(
          titre: titre,
          contenu: contenu,
          clientKey: clientKey,
        );
    ref.invalidateSelf();
    await future;
    return note;
  }

  Future<Note> updateNote(
    String id, {
    String? titre,
    String? contenu,
    bool? pinned,
  }) async {
    final note = await ref.read(noteServiceProvider).update(
          id,
          titre: titre,
          contenu: contenu,
          pinned: pinned,
        );
    ref.invalidateSelf();
    await future;
    return note;
  }

  Future<void> deleteNote(String id) async {
    await ref.read(noteServiceProvider).remove(id);
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }
    state = AsyncData(current.where((note) => note.id != id).toList());
  }
}
