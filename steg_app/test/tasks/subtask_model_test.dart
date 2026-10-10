import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/subtask.dart';

void main() {
  group('SubtaskStatus', () {
    test('exposes the exact backend values and progress weights', () {
      expect(SubtaskStatus.todo.value, 'TODO');
      expect(SubtaskStatus.todo.progress, 0);
      expect(SubtaskStatus.inProgress.value, 'IN_PROGRESS');
      expect(SubtaskStatus.inProgress.progress, 50);
      expect(SubtaskStatus.done.value, 'DONE');
      expect(SubtaskStatus.done.progress, 100);
    });

    test('fromValue parses known statuses and falls back to todo', () {
      expect(SubtaskStatus.fromValue('TODO'), SubtaskStatus.todo);
      expect(SubtaskStatus.fromValue('IN_PROGRESS'), SubtaskStatus.inProgress);
      expect(SubtaskStatus.fromValue('DONE'), SubtaskStatus.done);
      expect(SubtaskStatus.fromValue('TERMINEE'), isNull);
    });
  });

  group('Subtask.fromJson', () {
    test('parses a realistic backend row', () {
      final subtask = Subtask.fromJson({
        'id': 's1',
        'tache_id': 't1',
        'titre': 'Rédiger',
        'description': 'Premier jet',
        'statut': 'IN_PROGRESS',
      });

      expect(subtask.id, 's1');
      expect(subtask.tacheId, 't1');
      expect(subtask.titre, 'Rédiger');
      expect(subtask.description, 'Premier jet');
      expect(subtask.status, SubtaskStatus.inProgress);
      expect(subtask.statusLabel, 'En cours');
      expect(subtask.progressValue, 50);
    });

    test('unknown statut falls back to todo without crashing', () {
      final subtask = Subtask.fromJson({
        'id': 's1',
        'tache_id': 't1',
        'titre': 'X',
        'statut': 'BOGUS',
      });

      expect(subtask.status, SubtaskStatus.todo);
      expect(subtask.progressValue, 0);
    });
  });

  group('SubtaskAggregate.fromSubtasks', () {
    test('empty list is an explicit empty state, never NaN', () {
      final aggregate = SubtaskAggregate.fromSubtasks([]);

      expect(aggregate.total, 0);
      expect(aggregate.progress, isNull);
      expect(aggregate.isEmpty, isTrue);
      expect(aggregate.progressLabel, '—');
    });

    test('TODO + TODO = 0 %', () {
      final aggregate = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'TODO'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'TODO'),
      ]);

      expect(aggregate.total, 2);
      expect(aggregate.progress, 0);
    });

    test('TODO + IN_PROGRESS = 25 %', () {
      final aggregate = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'TODO'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'IN_PROGRESS'),
      ]);

      expect(aggregate.progress, 25);
    });

    test('TODO + DONE = 50 % and DONE + DONE = 100 %', () {
      final half = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'TODO'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'DONE'),
      ]);
      final full = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'DONE'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'DONE'),
      ]);

      expect(half.progress, 50);
      expect(full.progress, 100);
      expect(full.isComplete, isTrue);
      expect(half.isComplete, isFalse);
    });

    test('IN_PROGRESS + DONE = 75 %', () {
      final aggregate = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'IN_PROGRESS'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'DONE'),
      ]);

      expect(aggregate.progress, 75);
      expect(aggregate.isComplete, isFalse);
    });

    test('rounds to an integer', () {
      final aggregate = SubtaskAggregate.fromSubtasks([
        Subtask(id: 'a', tacheId: 't', titre: 'a', statut: 'TODO'),
        Subtask(id: 'b', tacheId: 't', titre: 'b', statut: 'IN_PROGRESS'),
        Subtask(id: 'c', tacheId: 't', titre: 'c', statut: 'IN_PROGRESS'),
      ]);

      expect(aggregate.progress, 33);
    });
  });
}
