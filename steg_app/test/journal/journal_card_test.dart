import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/journal_entry.dart';
import 'package:steg_app/widgets/journal/journal_card.dart';

JournalEntry _makeJournal({
  String id = 'j1',
  String statut = 'BROUILLON',
  String travaux = 'Travaux de la semaine',
  String competences = 'Angular, Git',
  String commentaireEncadrant = '',
  String heures = '36',
}) {
  return JournalEntry.fromJson({
    'id': id,
    'stage_id': 'stage-1',
    'semaine': '2026-01-12',
    'travaux': travaux,
    'heures': heures,
    'statut': statut,
    'competences': competences,
    'commentaire_encadrant': commentaireEncadrant,
    'stagiaire_nom': 'Trabelsi',
    'stagiaire_prenom': 'Fatma',
  });
}

void main() {
  group('JournalCard', () {
    testWidgets('displays the week range and status chip', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: JournalCard(journal: _makeJournal())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Semaine du 12/01/2026 au 18/01/2026'), findsOneWidget);
      expect(find.text('Brouillon'), findsOneWidget);
      expect(find.text('36 h'), findsOneWidget);
    });

    testWidgets('displays travaux and competences', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: JournalCard(journal: _makeJournal())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Travaux de la semaine'), findsOneWidget);
      expect(find.text('Compétences : Angular, Git'), findsOneWidget);
    });

    testWidgets('shows stagiaire name', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: JournalCard(journal: _makeJournal())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Fatma Trabelsi'), findsOneWidget);
    });

    testWidgets('shows encadrant feedback when present', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: JournalCard(
            journal: _makeJournal(
              statut: 'VALIDE',
              commentaireEncadrant: 'Très bon travail',
            ),
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Commentaire de l\'encadrant'), findsOneWidget);
      expect(find.text('Très bon travail'), findsOneWidget);
    });

    testWidgets('hides encadrant feedback when empty', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: JournalCard(journal: _makeJournal())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Commentaire de l\'encadrant'), findsNothing);
    });

    testWidgets('shows action buttons when callbacks provided', (tester) async {
      var editTapped = false;
      var submitTapped = false;
      var deleteTapped = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: JournalCard(
            journal: _makeJournal(),
            onEdit: () => editTapped = true,
            onSubmit: () => submitTapped = true,
            onDelete: () => deleteTapped = true,
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Modifier'), findsOneWidget);
      expect(find.text('Soumettre'), findsOneWidget);
      expect(find.byIcon(Icons.delete_outline), findsOneWidget);

      await tester.tap(find.text('Modifier'));
      expect(editTapped, isTrue);

      await tester.tap(find.text('Soumettre'));
      expect(submitTapped, isTrue);

      await tester.tap(find.byIcon(Icons.delete_outline));
      expect(deleteTapped, isTrue);
    });

    testWidgets('hides action buttons when no callbacks provided', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(body: JournalCard(journal: _makeJournal())),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Modifier'), findsNothing);
      expect(find.text('Soumettre'), findsNothing);
      expect(find.byIcon(Icons.delete_outline), findsNothing);
    });

    testWidgets('shows validate and reject buttons when provided', (tester) async {
      var validateTapped = false;
      var rejectTapped = false;

      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: JournalCard(
            journal: _makeJournal(statut: 'SOUMIS'),
            onValidate: () => validateTapped = true,
            onReject: () => rejectTapped = true,
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Valider'), findsOneWidget);
      expect(find.text('Rejeter'), findsOneWidget);

      await tester.tap(find.text('Valider'));
      expect(validateTapped, isTrue);

      await tester.tap(find.text('Rejeter'));
      expect(rejectTapped, isTrue);
    });
  });
}
