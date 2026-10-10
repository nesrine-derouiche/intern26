import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/models/subtask.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/screens/dashboard/task_details_screen.dart';
import 'package:steg_app/services/tache_service.dart';
import 'package:steg_app/widgets/tasks/subtask_todo_list.dart';
import 'package:steg_app/widgets/tasks/todo_status_control.dart';

const parentTask = Tache(
  id: 't1',
  projetTitre: 'Projet A',
  createurNom: 'Ben',
  createurPrenom: 'Ali',
  titre: 'Rédiger le cahier des charges',
  description: 'Décrire le besoin fonctionnel.',
  priorite: 'HAUTE',
  statut: 'EN_COURS',
  progress: 0,
  estimatedHours: 5,
  spentHours: 0,
);

Subtask subtask(
  String id,
  String titre, {
  String statut = 'TODO',
  String? description,
}) {
  return Subtask(
    id: id,
    tacheId: 't1',
    titre: titre,
    description: description,
    statut: statut,
  );
}

class FakeTacheService extends TacheService {
  FakeTacheService() : super(Dio());

  List<Subtask> subtasks = [
    subtask('s1', 'Rédiger'),
    subtask('s2', 'Relire', statut: 'DONE', description: 'Relecture croisée'),
  ];
  int updateCalls = 0;
  bool failList = false;
  bool failUpdate = false;
  Completer<void>? updateGate;
  SubtaskStatus? lastRequestedStatus;

  SubtaskListResult _result() => SubtaskListResult(
        subtasks: List.of(subtasks),
        aggregate: SubtaskAggregate.fromSubtasks(subtasks),
      );

  @override
  Future<SubtaskListResult> listSubtasks({required String taskId}) async {
    if (failList) {
      throw const ApiException(500, 'Erreur serveur.');
    }
    return _result();
  }

  @override
  Future<Subtask> updateSubtaskStatus({
    required String id,
    required SubtaskStatus status,
  }) async {
    updateCalls++;
    lastRequestedStatus = status;
    final gate = updateGate;
    if (gate != null) await gate.future;
    if (failUpdate) {
      throw const ApiException(403, 'Accès refusé.');
    }
    subtasks = [
      for (final item in subtasks)
        if (item.id == id) item.copyWith(statut: status.value) else item,
    ];
    return subtasks.firstWhere((item) => item.id == id);
  }
}

Widget buildTestApp(FakeTacheService service, {Tache task = parentTask}) {
  return ProviderScope(
    overrides: [
      tacheServiceProvider.overrideWithValue(service),
    ],
    child: MaterialApp(
      home: TaskDetailsScreen(task: task),
    ),
  );
}

Future<void> openStatusSheet(WidgetTester tester, String subtaskId) async {
  await tester.tap(find.byKey(ValueKey('status-control-$subtaskId')));
  await tester.pumpAndSettle();
}

void main() {
  group('parent task card', () {
    testWidgets('renders parent info and subtasks with statuses',
        (tester) async {
      final service = FakeTacheService();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      expect(find.text('Rédiger le cahier des charges'), findsOneWidget);
      expect(find.text('Décrire le besoin fonctionnel.'), findsOneWidget);
      expect(find.text('Rédiger'), findsOneWidget);
      expect(find.text('Relire'), findsOneWidget);
      expect(find.text('Relecture croisée'), findsOneWidget);
      expect(find.text('2 sous-tâches'), findsOneWidget);
      expect(find.text('50 %'), findsOneWidget);
    });

    testWidgets('shows an empty state when the task has no subtasks',
        (tester) async {
      final service = FakeTacheService()..subtasks = [];
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      expect(find.text('Aucune sous-tâche'), findsNWidgets(2));
      expect(find.textContaining('%'), findsNothing);
      expect(find.textContaining('NaN'), findsNothing);
      expect(find.textContaining('Infinity'), findsNothing);
    });

    testWidgets('shows an error state when the API fails', (tester) async {
      final service = FakeTacheService()..failList = true;
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      expect(find.text('Erreur serveur.'), findsOneWidget);
      expect(find.text('Rédiger le cahier des charges'), findsOneWidget);
      expect(find.textContaining('NaN'), findsNothing);
      expect(find.textContaining('Infinity'), findsNothing);
    });
  });

  group('three-state status controls', () {
    testWidgets(
        'renders TODO / IN_PROGRESS / DONE controls and softens done text',
        (tester) async {
      final service = FakeTacheService()
        ..subtasks = [
          subtask('s1', 'Créer la table utilisateurs', statut: 'TODO'),
          subtask('s2', 'Ajouter les relations', statut: 'IN_PROGRESS'),
          subtask('s3', 'Tester les requêtes', statut: 'DONE'),
        ];
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      final controls = tester
          .widgetList<TodoStatusControl>(find.byType(TodoStatusControl))
          .toList();
      expect(controls, hasLength(3));
      expect(controls[0].status, SubtaskStatus.todo);
      expect(controls[1].status, SubtaskStatus.inProgress);
      expect(controls[2].status, SubtaskStatus.done);
      expect(controls.any((control) => control.loading), isFalse);

      expect(find.byIcon(Icons.check_rounded), findsOneWidget);

      final doneText =
          tester.widget<Text>(find.text('Tester les requêtes'));
      expect(doneText.style?.decoration, TextDecoration.lineThrough);
      final todoText =
          tester.widget<Text>(find.text('Créer la table utilisateurs'));
      expect(todoText.style?.decoration, isNot(TextDecoration.lineThrough));

      expect(find.byType(SegmentedButton<SubtaskStatus>), findsNothing);
      expect(find.byType(SubtaskTodoList), findsOneWidget);
    });

    testWidgets('tapping the control opens the status selector sheet',
        (tester) async {
      final service = FakeTacheService();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      await openStatusSheet(tester, 's1');

      expect(find.text('Statut de la sous-tâche'), findsOneWidget);
      expect(find.text('À faire — 0 %'), findsOneWidget);
      expect(find.text('En cours — 50 %'), findsOneWidget);
      expect(find.text('Terminée — 100 %'), findsOneWidget);

      final selected = tester.widget<Material>(
        find.byKey(const ValueKey('status-option-todo')),
      );
      expect(selected.color, isNotNull);
      expect(selected.color.toString(), isNot(Colors.transparent.toString()));
      final other = tester.widget<Material>(
        find.byKey(const ValueKey('status-option-done')),
      );
      expect(other.color.toString(), Colors.transparent.toString());
      expect(service.updateCalls, 0);
    });

    testWidgets('re-selecting the current status closes without an API call',
        (tester) async {
      final service = FakeTacheService();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      await openStatusSheet(tester, 's1');
      await tester.tap(find.text('À faire — 0 %'));
      await tester.pumpAndSettle();

      expect(find.text('Statut de la sous-tâche'), findsNothing);
      expect(service.updateCalls, 0);
    });

    testWidgets('successful update calls the API and refreshes progress',
        (tester) async {
      final service = FakeTacheService();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      expect(find.text('50 %'), findsOneWidget);

      await openStatusSheet(tester, 's1');
      await tester.tap(find.text('Terminée — 100 %'));
      await tester.pumpAndSettle();

      expect(service.updateCalls, 1);
      expect(service.lastRequestedStatus, SubtaskStatus.done);
      expect(find.text('100 %'), findsOneWidget);
      expect(find.text('Tâche terminée'), findsOneWidget);

      final control = tester.widget<TodoStatusControl>(
        find.byKey(const ValueKey('status-control-s1')),
      );
      expect(control.status, SubtaskStatus.done);
      expect(control.loading, isFalse);
    });

    testWidgets('shows a per-row loading state while the API call runs',
        (tester) async {
      final service = FakeTacheService()..updateGate = Completer<void>();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      await openStatusSheet(tester, 's1');
      await tester.tap(find.text('En cours — 50 %'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final loadingControl = tester.widget<TodoStatusControl>(
        find.byKey(const ValueKey('status-control-s1')),
      );
      expect(loadingControl.loading, isTrue);
      expect(find.byType(CircularProgressIndicator), findsWidgets);

      service.updateGate!.complete();
      await tester.pumpAndSettle();

      final updatedControl = tester.widget<TodoStatusControl>(
        find.byKey(const ValueKey('status-control-s1')),
      );
      expect(updatedControl.loading, isFalse);
      expect(updatedControl.status, SubtaskStatus.inProgress);
      expect(service.updateCalls, 1);
      expect(find.text('75 %'), findsOneWidget);
    });

    testWidgets('shows a snackbar and keeps the state when the API fails',
        (tester) async {
      final service = FakeTacheService()..failUpdate = true;
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      await openStatusSheet(tester, 's1');
      await tester.tap(find.text('Terminée — 100 %'));
      await tester.pumpAndSettle();

      expect(service.updateCalls, 1);
      expect(find.textContaining('Mise à jour échouée'), findsOneWidget);

      final control = tester.widget<TodoStatusControl>(
        find.byKey(const ValueKey('status-control-s1')),
      );
      expect(control.status, SubtaskStatus.todo);
      expect(find.text('50 %'), findsOneWidget);
      expect(find.text('100 %'), findsNothing);
    });

    testWidgets('tapping the row opens the subtask details', (tester) async {
      final service = FakeTacheService();
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Relire'));
      await tester.pumpAndSettle();

      expect(find.text('Statut'), findsOneWidget);
      expect(find.text('Terminée'), findsOneWidget);
      expect(find.text('Relecture croisée'), findsWidgets);
      expect(service.updateCalls, 0);
    });
  });

  group('parent aggregate progress', () {
    const cases = <(List<String>, String)>[
      (['TODO', 'TODO'], '0 %'),
      (['TODO', 'IN_PROGRESS'], '25 %'),
      (['TODO', 'DONE'], '50 %'),
      (['IN_PROGRESS', 'DONE'], '75 %'),
      (['DONE', 'DONE'], '100 %'),
    ];

    for (final (statuses, expected) in cases) {
      testWidgets('renders the backend aggregate $expected without NaN',
          (tester) async {
        final service = FakeTacheService()
          ..subtasks = [
            for (var i = 0; i < statuses.length; i++)
              subtask('s$i', 'Sous-tâche $i', statut: statuses[i]),
          ];
        await tester.pumpWidget(buildTestApp(service));
        await tester.pumpAndSettle();

        expect(find.text(expected), findsOneWidget);
        expect(find.textContaining('NaN'), findsNothing);
        expect(find.textContaining('Infinity'), findsNothing);
      });
    }

    testWidgets('marks the task completed when every subtask is done',
        (tester) async {
      final service = FakeTacheService()
        ..subtasks = [
          subtask('s1', 'Créer la table utilisateurs', statut: 'DONE'),
          subtask('s2', 'Ajouter les relations', statut: 'DONE'),
        ];
      await tester.pumpWidget(buildTestApp(service));
      await tester.pumpAndSettle();

      expect(find.text('Tâche terminée'), findsOneWidget);
      expect(find.text('100 %'), findsOneWidget);
      expect(find.byIcon(Icons.check_rounded), findsWidgets);
      expect(find.textContaining('NaN'), findsNothing);
    });
  });
}
