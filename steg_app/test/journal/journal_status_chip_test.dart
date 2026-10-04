import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/journal_entry.dart';
import 'package:steg_app/widgets/journal/journal_status_chip.dart';

void main() {
  group('JournalStatusChip', () {
    testWidgets('displays the label for each status', (tester) async {
      for (final statut in JournalStatut.values) {
        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: JournalStatusChip(statut: statut),
          ),
        ));
        await tester.pumpAndSettle();

        expect(find.text(statut.label), findsOneWidget);
      }
    });

    testWidgets('renders without error for each status', (tester) async {
      for (final statut in JournalStatut.values) {
        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: Center(child: JournalStatusChip(statut: statut)),
          ),
        ));
        await tester.pumpAndSettle();
        expect(find.byType(JournalStatusChip), findsOneWidget);
      }
    });
  });
}
