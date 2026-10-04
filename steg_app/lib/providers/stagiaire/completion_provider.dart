import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/completion_data.dart';
import '../../providers/core/api_client_provider.dart';
import '../../services/completion_service.dart';

final completionServiceProvider = Provider<CompletionService>(
  (ref) => CompletionService(ref.watch(dioProvider)),
);

final completionProvider =
    AsyncNotifierProvider<CompletionNotifier, CompletionData>(
  CompletionNotifier.new,
);

class CompletionNotifier extends AsyncNotifier<CompletionData> {
  @override
  Future<CompletionData> build() {
    return ref.read(completionServiceProvider).getCompletionData();
  }
}
