import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/route_paths.dart';
import '../../core/theme/app_colors.dart';
import '../../models/note.dart';
import '../../providers/notes/notes_provider.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

class NotesListScreen extends ConsumerStatefulWidget {
  const NotesListScreen({super.key});

  @override
  ConsumerState<NotesListScreen> createState() => _NotesListScreenState();
}

class _NotesListScreenState extends ConsumerState<NotesListScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(notesProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Notes'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(context, null),
        icon: const Icon(Icons.note_add_outlined),
        label: const Text('Nouvelle note'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Rechercher une note…',
                prefixIcon: const Icon(Icons.search_outlined),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Effacer',
                        icon: const Icon(Icons.clear_rounded),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                      ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          Expanded(
            child: notesAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (error, _) => ErrorView(
                message: error.toString(),
                onRetry: () => ref.refresh(notesProvider.future),
              ),
              data: (notes) {
                final filtered = _filter(notes, _query);
                if (filtered.isEmpty) {
                  return EmptyState(
                    icon: Icons.note_alt_outlined,
                    title: _query.isEmpty ? 'Aucune note' : 'Aucun résultat',
                    message: _query.isEmpty
                        ? 'Vos idées et brouillons privés apparaîtront ici.'
                        : 'Aucune note ne correspond à « $_query ».',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.refresh(notesProvider.future),
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final note = filtered[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _NoteCard(
                          note: note,
                          onTap: () => _openEditor(context, note),
                          onTogglePin: () => _togglePin(note),
                          onDelete: () => _confirmDelete(context, note),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Note> _filter(List<Note> notes, String query) {
    final term = query.trim().toLowerCase();
    if (term.isEmpty) return notes;
    return notes
        .where(
          (note) =>
              note.titre.toLowerCase().contains(term) ||
              note.contenu.toLowerCase().contains(term),
        )
        .toList();
  }

  Future<void> _openEditor(BuildContext context, Note? note) async {
    await context.push(RoutePaths.noteEditor, extra: note);
  }

  Future<void> _togglePin(Note note) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(notesProvider.notifier)
          .updateNote(note.id, pinned: !note.pinned);
    } catch (error) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('Épinglage échoué : $error')),
        );
    }
  }

  Future<void> _confirmDelete(BuildContext context, Note note) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer la note'),
        content: Text(
          'La note « ${note.displayTitle} » sera définitivement supprimée.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(notesProvider.notifier).deleteNote(note.id);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Note supprimée.')));
    } catch (error) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('Suppression échouée : $error')),
        );
    }
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({
    required this.note,
    required this.onTap,
    required this.onTogglePin,
    required this.onDelete,
  });

  final Note note;
  final VoidCallback onTap;
  final VoidCallback onTogglePin;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (note.pinned)
                          const Padding(
                            padding: EdgeInsets.only(right: 6),
                            child: Icon(
                              Icons.push_pin_rounded,
                              size: 14,
                              color: AppColors.warning,
                            ),
                          ),
                        Expanded(
                          child: Text(
                            note.displayTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (note.snippet.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        note.snippet,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      note.updatedLabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: note.pinned ? 'Désépingler' : 'Épingler',
                icon: Icon(
                  note.pinned
                      ? Icons.push_pin_rounded
                      : Icons.push_pin_outlined,
                  color: note.pinned
                      ? AppColors.warning
                      : AppColors.textTertiary,
                ),
                onPressed: onTogglePin,
              ),
              IconButton(
                tooltip: 'Supprimer',
                icon: const Icon(
                  Icons.delete_outline,
                  color: AppColors.danger,
                ),
                onPressed: onDelete,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
