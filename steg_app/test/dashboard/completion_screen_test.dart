import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/completion_data.dart';
import 'package:steg_app/providers/stagiaire/completion_provider.dart';
import 'package:steg_app/screens/dashboard/completion_screen.dart';

CompletionData _makeCompleted() {
  return CompletionData.fromJson({
    'stage': {
      'id': 's1',
      'date_debut': '2026-01-15',
      'date_fin': '2026-07-15',
      'statut': 'TERMINE',
      'stagiaire_nom': 'Trabelsi',
      'stagiaire_prenom': 'Fatma',
      'encadrant_nom': 'Ben Salah',
      'encadrant_prenom': 'Ahmed',
      'departement_nom': 'Informatique',
      'offre_titre': 'Développement Web',
    },
    'evaluation': {
      'id': 'e1',
      'technique': 16,
      'communication': 14,
      'autonomie': 15,
      'ponctualite': 18,
      'qualite': 17,
      'note_finale': '16.00',
      'commentaire': 'Bon travail global.',
      'date_evaluation': '2026-07-10',
      'validee': true,
      'encadrant_nom': 'Ben Salah',
      'encadrant_prenom': 'Ahmed',
    },
    'is_completed': true,
    'completion_date': '2026-07-15',
    'available_documents': ['convention', 'attestation', 'evaluation'],
  });
}

CompletionData _makeInProgress() {
  return CompletionData.fromJson({
    'stage': {
      'id': 's1',
      'date_debut': '2026-01-15',
      'date_fin': '2026-07-15',
      'statut': 'EN_COURS',
      'stagiaire_nom': 'Trabelsi',
      'stagiaire_prenom': 'Fatma',
      'encadrant_nom': 'Ben Salah',
      'encadrant_prenom': 'Ahmed',
      'departement_nom': 'Informatique',
      'offre_titre': 'Développement Web',
    },
    'evaluation': null,
    'is_completed': false,
    'completion_date': null,
    'available_documents': ['convention'],
  });
}

Widget _buildApp(CompletionData data) {
  return ProviderScope(
    overrides: [
      completionProvider.overrideWith(() => _FakeCompletionNotifier(data)),
    ],
    child: const MaterialApp(home: CompletionScreen()),
  );
}

class _FakeCompletionNotifier extends CompletionNotifier {
  _FakeCompletionNotifier(this._data);
  final CompletionData _data;

  @override
  Future<CompletionData> build() async => _data;
}

void main() {
  group('CompletionScreen', () {
    testWidgets('shows completed state with evaluation and documents', (tester) async {
      tester.view.physicalSize = const Size(800, 2200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp(_makeCompleted()));
      await tester.pumpAndSettle();

      expect(find.text('Stage terminé'), findsOneWidget);
      expect(find.text('Terminé le 15/07/2026'), findsOneWidget);
      expect(find.text('Note finale : 16/20'), findsOneWidget);
      expect(find.text('Évaluation finale'), findsOneWidget);
      expect(find.text('Par Ahmed Ben Salah'), findsOneWidget);
      expect(find.textContaining('Moyenne générale'), findsWidgets);
      expect(find.text('Documents disponibles'), findsOneWidget);
      expect(find.text('Convention de stage'), findsOneWidget);
      expect(find.text('Attestation de stage'), findsOneWidget);
      expect(find.text('Fiche d\'évaluation'), findsOneWidget);
    });

    testWidgets('shows in-progress state without evaluation', (tester) async {
      await tester.pumpWidget(_buildApp(_makeInProgress()));
      await tester.pumpAndSettle();

      expect(find.text('Stage en cours'), findsOneWidget);
      expect(find.text('En attente de finalisation'), findsOneWidget);
      expect(find.text('Évaluation finale'), findsNothing);
      expect(find.text('Documents disponibles'), findsNothing);
    });

    testWidgets('shows evaluation criteria bars', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp(_makeCompleted()));
      await tester.pumpAndSettle();

      expect(find.text('Compétences techniques'), findsOneWidget);
      expect(find.text('Communication'), findsOneWidget);
      expect(find.text('Autonomie'), findsOneWidget);
      expect(find.text('Ponctualité'), findsOneWidget);
      expect(find.text('Qualité du travail'), findsOneWidget);
      expect(find.text('16/20'), findsWidgets);
      expect(find.text('14/20'), findsOneWidget);
      expect(find.text('15/20'), findsWidgets);
      expect(find.text('18/20'), findsOneWidget);
      expect(find.text('17/20'), findsOneWidget);
    });

    testWidgets('shows evaluation commentaire', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp(_makeCompleted()));
      await tester.pumpAndSettle();

      expect(find.text('Commentaire'), findsOneWidget);
      expect(find.text('Bon travail global.'), findsOneWidget);
    });

    testWidgets('shows stage info section', (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_buildApp(_makeCompleted()));
      await tester.pumpAndSettle();

      expect(find.text('Informations du stage'), findsOneWidget);
      expect(find.text('Développement Web'), findsOneWidget);
      expect(find.text('Informatique'), findsOneWidget);
      expect(find.text('Ahmed Ben Salah'), findsWidgets);
      expect(find.textContaining('15/01/2026'), findsOneWidget);
    });
  });
}
