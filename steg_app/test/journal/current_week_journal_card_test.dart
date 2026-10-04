import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/utils/date_utils.dart';
import 'package:steg_app/models/journal_entry.dart';
import 'package:steg_app/widgets/journal/current_week_journal_card.dart';

JournalEntry _currentWeekJournal({
  String statut = 'BROUILLON',
  String travaux = 'Travaux de la semaine',
  String commentaireEncadrant = '',
}) {
  return JournalEntry.fromJson({
    'id': 'j-current',
    'stage_id': 'stage-1',
    'semaine': formatDateFr(startOfWeek(DateTime.now())),
    'travaux': travaux,
    'heures': '36',
    'statut': statut,
    'commentaire_encadrant': commentaireEncadrant,
    'offre_titre': 'Développeur Angular',
  });
}

void main() {
  group('CurrentWeekJournalCard', () {
    testWidgets('shows the week range for the current week', (tester) async {
      final now = DateTime.now();
      final weekStart = startOfWeek(now);

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: _currentWeekJournal(),
            onCreate: () {},
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Semaine en cours'), findsOneWidget);
      final expected = 'du ${formatDateFr(weekStart)} au ${formatDateFr(weekStart.add(const Duration(days: 6)))}';
      expect(find.text(expected), findsOneWidget);
    });

    testWidgets('shows Réédiger prompt when no journal exists for current week',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: null,
            onCreate: () {},
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Aucun journal pour cette semaine.'), findsOneWidget);
      expect(find.text('Rédiger'), findsOneWidget);
    });

    testWidgets('calls onCreate when Réédiger is tapped', (tester) async {
      var called = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: null,
            onCreate: () => called = true,
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Rédiger'));
      expect(called, isTrue);
    });

    testWidgets('shows journal summary with status, travaux, and hours',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: _currentWeekJournal(),
            onCreate: () {},
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Brouillon'), findsOneWidget);
      expect(find.text('Travaux de la semaine'), findsOneWidget);
      expect(find.text('36 h'), findsOneWidget);
      expect(find.text('Développeur Angular'), findsOneWidget);
    });

    testWidgets('shows edit and submit buttons for editable journals',
        (tester) async {
      var editTapped = false;
      var submitTapped = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: _currentWeekJournal(),
            onCreate: () {},
            onEdit: () => editTapped = true,
            onSubmit: () => submitTapped = true,
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Modifier'), findsOneWidget);
      expect(find.text('Soumettre'), findsOneWidget);

      await tester.tap(find.text('Modifier'));
      expect(editTapped, isTrue);

      await tester.tap(find.text('Soumettre'));
      expect(submitTapped, isTrue);
    });

    testWidgets('hides edit/submit buttons for non-editable journals',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: _currentWeekJournal(statut: 'VALIDE'),
            onCreate: () {},
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Modifier'), findsNothing);
      expect(find.text('Soumettre'), findsNothing);
      expect(find.text('Validé'), findsOneWidget);
    });

    testWidgets('shows encadrant feedback when present', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CurrentWeekJournalCard(
            currentWeekJournal: _currentWeekJournal(
              statut: 'REJETE',
              commentaireEncadrant: 'Merci de détailler',
            ),
            onCreate: () {},
            onEdit: () {},
            onSubmit: () {},
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Merci de détailler'), findsOneWidget);
    });
  });
}
