import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/core/theme/app_colors.dart';
import 'package:steg_app/models/subtask.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/services/tache_service.dart';
import 'package:steg_app/widgets/tasks/parent_task_card.dart';

final parentTask = Tache(
  id: 't1',
  projetTitre: 'Projet A',
  createurNom: 'Ben',
  createurPrenom: 'Ali',
  titre: 'Configurer la base de données',
  description: 'Mise en place de PostgreSQL',
  priorite: 'HAUTE',
  statut: 'EN_COURS',
  progress: 0,
  dateFin: DateTime(2026, 10, 13),
  estimatedHours: 8,
  spentHours: 2,
);

Subtask subtask(String id, String statut) =>
    Subtask(id: id, tacheId: 't1', titre: id, statut: statut);

class FakeTacheService extends TacheService {
  FakeTacheService() : super(Dio());

  List<Subtask> subtasks = [
    subtask('s1', 'TODO'),
    subtask('s2', 'IN_PROGRESS'),
    subtask('s3', 'DONE'),
  ];
  Completer<SubtaskListResult>? gate;

  @override
  Future<SubtaskListResult> listSubtasks({required String taskId}) {
    final pending = gate;
    if (pending != null) return pending.future;
    return Future.value(
      SubtaskListResult(
        subtasks: List.of(subtasks),
        aggregate: SubtaskAggregate.fromSubtasks(subtasks),
      ),
    );
  }
}

Widget buildCard(FakeTacheService service) {
  return ProviderScope(
    overrides: [tacheServiceProvider.overrideWithValue(service)],
    child: MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: ParentTaskCard(task: parentTask, onTap: () {}),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets(
      'renders title, description, subtask count, progress and deadline',
      (tester) async {
    final service = FakeTacheService();
    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    expect(find.text('Configurer la base de données'), findsOneWidget);
    expect(find.text('Mise en place de PostgreSQL'), findsOneWidget);
    expect(find.text('3 sous-tâches'), findsOneWidget);
    expect(find.text('50 %'), findsOneWidget);
    expect(find.textContaining('Échéance'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.byType(Checkbox), findsNothing);
    expect(find.byType(Radio<SubtaskStatus>), findsNothing);
  });

  testWidgets('keeps a subtle non-completed surface', (tester) async {
    final service = FakeTacheService();
    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    final card = tester.widget<Card>(find.byType(Card));
    final shape = card.shape! as RoundedRectangleBorder;
    expect(shape.side.color, AppColors.border);
    expect(find.text('Tâche terminée'), findsNothing);
  });

  testWidgets('shows the completed visual state when all subtasks are done',
      (tester) async {
    final service = FakeTacheService()
      ..subtasks = [subtask('s1', 'DONE'), subtask('s2', 'DONE')];
    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    expect(find.text('Tâche terminée'), findsOneWidget);
    expect(find.text('100 %'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    final card = tester.widget<Card>(find.byType(Card));
    final shape = card.shape! as RoundedRectangleBorder;
    expect(shape.side.color, AppColors.success.withValues(alpha: 0.45));

    expect(find.text('Configurer la base de données'), findsOneWidget);
  });

  testWidgets('renders 0 % for an all-TODO task without NaN', (tester) async {
    final service = FakeTacheService()
      ..subtasks = [subtask('s1', 'TODO'), subtask('s2', 'TODO')];
    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    expect(find.text('0 %'), findsOneWidget);
    expect(find.textContaining('NaN'), findsNothing);
    expect(find.textContaining('Infinity'), findsNothing);
  });

  testWidgets('renders Aucune sous-tâche without any percent', (tester) async {
    final service = FakeTacheService()..subtasks = [];
    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    expect(find.text('Aucune sous-tâche'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.textContaining('NaN'), findsNothing);
    expect(find.textContaining('Infinity'), findsNothing);
  });

  testWidgets('shows no percent while subtasks are loading', (tester) async {
    final service = FakeTacheService()..gate = Completer<SubtaskListResult>();
    await tester.pumpWidget(buildCard(service));
    await tester.pump();

    expect(find.text('Configurer la base de données'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('NaN'), findsNothing);
    expect(find.textContaining('Infinity'), findsNothing);

    service.gate!.complete(
      SubtaskListResult(
        subtasks: [subtask('s1', 'DONE')],
        aggregate: SubtaskAggregate.fromSubtasks([subtask('s1', 'DONE')]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('100 %'), findsOneWidget);
    expect(find.text('Tâche terminée'), findsOneWidget);
  });

  testWidgets('adapts to a small phone width without overflow',
      (tester) async {
    final service = FakeTacheService()
      ..subtasks = [
        subtask('s1', 'DONE'),
        subtask('s2', 'DONE'),
        subtask('s3', 'DONE'),
      ];
    tester.view.physicalSize = const Size(320 * 3, 900 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(buildCard(service));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Configurer la base de données'), findsOneWidget);
    expect(find.text('100 %'), findsOneWidget);
  });
}
