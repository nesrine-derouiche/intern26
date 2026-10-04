import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/journal_entry.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/journal/journal_providers.dart';
import '../../widgets/common/app_card.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/skeleton_box.dart';
import '../../widgets/journal/journal_card.dart';
import '../../widgets/journal/current_week_journal_card.dart';
import 'journal_form_screen.dart';

class JournalScreen extends ConsumerWidget {
  const JournalScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).value?.session?.user;
    final journalsAsync = ref.watch(myJournalsProvider);
    final canCreate = user?.role == 'STAGIAIRE';

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Journal hebdomadaire'),
        actions: [
          if (canCreate)
            IconButton(
              tooltip: 'Nouveau journal',
              icon: const Icon(Icons.add),
              onPressed: () => _openCreate(context, ref),
            ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _openCreate(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('Nouvelle semaine'),
            )
          : null,
      body: _buildBody(context, ref, user, journalsAsync),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    User? user,
    AsyncValue<List<JournalEntry>> journalsAsync,
  ) {
    if (user == null ||
        (user.role != 'STAGIAIRE' &&
            user.role != 'ENCADRANT' &&
            user.role != 'CHEF_DEPARTEMENT')) {
      return const EmptyState(
        icon: Icons.menu_book_outlined,
        title: 'Journal indisponible',
        message: 'Ce module n\'est pas accessible pour votre profil.',
      );
    }

    if (journalsAsync.isLoading && !journalsAsync.hasValue) {
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (context, index) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: _JournalSkeleton(),
        ),
      );
    }

    if (journalsAsync.hasError && !journalsAsync.hasValue) {
      return ErrorView(
        message: journalsAsync.error.toString(),
        onRetry: () => ref.refresh(myJournalsProvider.future),
      );
    }

    final journals = journalsAsync.value ?? const <JournalEntry>[];

    if (journals.isEmpty) {
      return RefreshIndicator(
        onRefresh: () => ref.refresh(myJournalsProvider.future),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(
                icon: Icons.menu_book_outlined,
                title: 'Aucun journal',
                message: user.role == 'STAGIAIRE'
                    ? 'Rédigez votre premier journal hebdomadaire.'
                    : 'Aucun journal soumis pour le moment.',
              ),
            ),
          ],
        ),
      );
    }

    final currentWeekJournal = user.role == 'STAGIAIRE'
        ? _findCurrentWeekJournal(journals)
        : null;
    final otherJournals = currentWeekJournal != null
        ? journals.where((j) => j.id != currentWeekJournal.id).toList()
        : journals;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(myJournalsProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (user.role == 'STAGIAIRE') ...[
            CurrentWeekJournalCard(
              currentWeekJournal: currentWeekJournal,
              onCreate: () => _openCreate(context, ref),
              onEdit: currentWeekJournal != null
                  ? () => _openEdit(context, ref, currentWeekJournal)
                  : () {},
              onSubmit: currentWeekJournal != null
                  ? () => _confirmSubmit(context, ref, currentWeekJournal)
                  : () {},
            ),
            const SizedBox(height: 16),
          ],
          for (final journal in otherJournals)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: JournalCard(
                journal: journal,
                onEdit: user.role == 'STAGIAIRE' && journal.isEditable
                    ? () => _openEdit(context, ref, journal)
                    : null,
                onSubmit: user.role == 'STAGIAIRE' && journal.isEditable
                    ? () => _confirmSubmit(context, ref, journal)
                    : null,
                onValidate:
                    user.role == 'ENCADRANT' &&
                        journal.statut == JournalStatut.soumis
                    ? () => _openDecision(context, ref, journal, validate: true)
                    : null,
                onReject:
                    user.role == 'ENCADRANT' &&
                        journal.statut == JournalStatut.soumis
                    ? () =>
                          _openDecision(context, ref, journal, validate: false)
                    : null,
                onDelete:
                    user.role == 'STAGIAIRE' &&
                        journal.statut == JournalStatut.brouillon
                    ? () => _confirmDelete(context, ref, journal)
                    : null,
              ),
            ),
        ],
      ),
    );
  }

  void _openCreate(BuildContext context, WidgetRef ref) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (context) => const JournalFormScreen()));
  }

  void _openEdit(BuildContext context, WidgetRef ref, JournalEntry journal) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => JournalFormScreen(journal: journal),
      ),
    );
  }

  Future<void> _confirmSubmit(
    BuildContext context,
    WidgetRef ref,
    JournalEntry journal,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Soumettre le journal'),
        content: const Text(
          'Après soumission, le journal sera transmis à votre encadrant '
          'pour validation. Vous ne pourrez plus le modifier.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Soumettre'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await ref.read(myJournalsProvider.notifier).submit(journal.id);
    if (context.mounted) _showSnack(context, 'Journal soumis pour validation.');
  }

  Future<void> _openDecision(
    BuildContext context,
    WidgetRef ref,
    JournalEntry journal, {
    required bool validate,
  }) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(validate ? 'Valider le journal' : 'Rejeter le journal'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              validate
                  ? 'Le journal de la semaine du ${journal.semaineLabel} '
                        'sera marqué comme validé.'
                  : 'Indiquez à la stagiaire les raisons du rejet '
                        'pour lui permettre de le corriger.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              maxLines: 3,
              maxLength: 500,
              decoration: InputDecoration(
                labelText: 'Commentaire (optionnel)',
                hintText: validate
                    ? 'Encouragements, observations...'
                    : 'Motif du rejet...',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(validate ? 'Valider' : 'Rejeter'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final notifier = ref.read(myJournalsProvider.notifier);
    if (validate) {
      await notifier.validate(journal.id, commentaire: controller.text);
    } else {
      await notifier.reject(journal.id, commentaire: controller.text);
    }
    if (context.mounted) {
      _showSnack(context, validate ? 'Journal validé.' : 'Journal rejeté.');
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    JournalEntry journal,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer le journal'),
        content: const Text(
          'Cette action est définitive. Le journal et son contenu seront '
          'supprimés.',
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
    if (confirmed != true || !context.mounted) return;
    await ref.read(myJournalsProvider.notifier).delete(journal.id);
    if (context.mounted) _showSnack(context, 'Journal supprimé.');
  }

  void _showSnack(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  JournalEntry? _findCurrentWeekJournal(List<JournalEntry> journals) {
    final now = DateTime.now();
    final weekStart = startOfWeek(now);
    final weekDateOnly = DateTime(weekStart.year, weekStart.month, weekStart.day);
    for (final j in journals) {
      if (j.semaine == null) continue;
      final jDate = DateTime(j.semaine!.year, j.semaine!.month, j.semaine!.day);
      if (jDate == weekDateOnly) return j;
    }
    return null;
  }
}

class _JournalSkeleton extends StatelessWidget {
  const _JournalSkeleton();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          SkeletonBox(width: 180, height: 16),
          SizedBox(height: 12),
          SkeletonBox(width: 260, height: 12),
          SizedBox(height: 8),
          SkeletonBox(width: 220, height: 12),
        ],
      ),
    );
  }
}
