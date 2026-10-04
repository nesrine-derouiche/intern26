import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/models/personal_tache.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/personal_tache/personal_tache_providers.dart';
import 'package:steg_app/screens/dashboard/my_tasks_screen.dart';

List<TacheSection> _buildSections(List<Tache> tasks) {
  final groups = <String, List<Tache>>{};
  for (final tache in tasks) {
    groups.putIfAbsent(tache.statut, () => []).add(tache);
  }
  return [
    for (final status in TacheStatut.values)
      TacheSection(status: status, items: groups[status.value] ?? const []),
  ];
}

class FakeMyTachesNotifier extends MyTachesNotifier {
  final List<Tache> _tasks;
  FakeMyTachesNotifier(this._tasks);

  @override
  Future<List<Tache>> build() async => _tasks;
}

class FakePersonalTachesNotifier extends PersonalTachesNotifier {
  @override
  Future<List<PersonalTache>> build() async => [];
}

Widget buildTestApp({required List<Tache> tasks}) {
  final sections = _buildSections(tasks);

  return ProviderScope(
    overrides: [
      myTachesProvider.overrideWith(() => FakeMyTachesNotifier(tasks)),
      tachesSectionsProvider.overrideWithValue(sections),
      personalTachesProvider.overrideWith(FakePersonalTachesNotifier.new),
    ],
    child: const MaterialApp(
      home: MyTasksScreen(),
    ),
  );
}

List<Tache> _sampleTasks() => [
      const Tache(
        id: 't1',
        projetTitre: 'Projet A',
        createurNom: 'Ben',
        createurPrenom: 'Ali',
        titre: 'Task Todo',
        description: '',
        priorite: 'MOYENNE',
        statut: 'A_FAIRE',
        progress: 0,
        estimatedHours: 5,
        spentHours: 0,
      ),
      const Tache(
        id: 't2',
        projetTitre: 'Projet A',
        createurNom: 'Ben',
        createurPrenom: 'Ali',
        titre: 'Task In Progress',
        description: '',
        priorite: 'HAUTE',
        statut: 'EN_COURS',
        progress: 50,
        estimatedHours: 10,
        spentHours: 5,
      ),
      const Tache(
        id: 't3',
        projetTitre: 'Projet A',
        createurNom: 'Ben',
        createurPrenom: 'Ali',
        titre: 'Task Done',
        description: '',
        priorite: 'BASSE',
        statut: 'TERMINEE',
        progress: 100,
        estimatedHours: 3,
        spentHours: 3,
      ),
      const Tache(
        id: 't4',
        projetTitre: 'Projet A',
        createurNom: 'Ben',
        createurPrenom: 'Ali',
        titre: 'Task Blocked',
        description: '',
        priorite: 'URGENTE',
        statut: 'BLOQUEE',
        progress: 20,
        estimatedHours: 8,
        spentHours: 2,
      ),
    ];

void main() {
  group('MyTasksScreen filter chips', () {
    testWidgets('shows filter chips with counts', (tester) async {
      await tester.pumpWidget(buildTestApp(tasks: _sampleTasks()));
      await tester.pumpAndSettle();

      expect(find.text('Toutes'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      // Status labels appear in both filter chips AND section headers
      expect(find.text('À faire'), findsWidgets);
      expect(find.text('En cours'), findsWidgets);
      expect(find.text('Terminée'), findsWidgets);
      expect(find.text('Bloquée'), findsWidgets);
    });

    testWidgets('shows all 4 tasks initially', (tester) async {
      await tester.pumpWidget(buildTestApp(tasks: _sampleTasks()));
      await tester.pumpAndSettle();

      expect(find.text('Task Todo'), findsOneWidget);
      expect(find.text('Task In Progress'), findsOneWidget);
      expect(find.text('Task Done'), findsOneWidget);
      // Scroll the list to build the lazy "Task Blocked" item
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(find.text('Task Blocked'), findsOneWidget);
    });

    testWidgets('filter by EN_COURS shows only that task', (tester) async {
      await tester.pumpWidget(buildTestApp(tasks: _sampleTasks()));
      await tester.pumpAndSettle();

      final enCoursChip = find.widgetWithText(GestureDetector, 'En cours');
      await tester.tap(enCoursChip.first);
      await tester.pumpAndSettle();

      expect(find.text('Task In Progress'), findsOneWidget);
      expect(find.text('Task Todo'), findsNothing);
      expect(find.text('Task Done'), findsNothing);
      expect(find.text('Task Blocked'), findsNothing);
    });

    testWidgets('tap active filter again clears filter', (tester) async {
      await tester.pumpWidget(buildTestApp(tasks: _sampleTasks()));
      await tester.pumpAndSettle();

      final enCoursChip = find.widgetWithText(GestureDetector, 'En cours');
      await tester.tap(enCoursChip.first);
      await tester.pumpAndSettle();
      expect(find.text('Task Todo'), findsNothing);

      await tester.tap(enCoursChip.first);
      await tester.pumpAndSettle();
      expect(find.text('Task Todo'), findsOneWidget);
    });

    testWidgets('shows empty state when no tasks', (tester) async {
      await tester.pumpWidget(buildTestApp(tasks: []));
      await tester.pumpAndSettle();

      expect(
        find.text('Aucune tâche assignée par votre encadrant.'),
        findsOneWidget,
      );
      expect(find.text('Toutes'), findsNothing);
    });
  });
}
