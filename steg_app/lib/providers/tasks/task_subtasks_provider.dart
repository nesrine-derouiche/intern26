import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/subtask.dart';
import '../dashboard/dashboard_providers.dart';

/// Subtasks of a parent task together with the backend-authoritative
/// aggregate (progress, counts) used by the Todo UI.
final taskSubtasksProvider =
    FutureProvider.family<SubtaskListResult, String>((ref, taskId) async {
  final service = ref.watch(tacheServiceProvider);
  return service.listSubtasks(taskId: taskId);
});
