import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/stagiaire/data/stagiaire_project_repository_impl.dart';
import '../../features/stagiaire/domain/stagiaire_project_repository.dart';
import '../../features/stagiaire/domain/usecases/get_stagiaire_project_usecase.dart';
import '../../models/stagiaire_project.dart';
import '../../services/stagiaire_project_service.dart';
import '../core/api_client_provider.dart';

final stagiaireProjectServiceProvider = Provider<StagiaireProjectService>(
  (ref) => StagiaireProjectService(ref.watch(dioProvider)),
);

final stagiaireProjectRepositoryProvider = Provider<StagiaireProjectRepository>(
  (ref) => StagiaireProjectRepositoryImpl(
    ref.watch(stagiaireProjectServiceProvider),
  ),
);

final getStagiaireProjectUseCaseProvider = Provider<GetStagiaireProjectUseCase>(
  (ref) => GetStagiaireProjectUseCase(
    ref.watch(stagiaireProjectRepositoryProvider),
  ),
);

final stagiaireProjectProvider =
    AsyncNotifierProvider<StagiaireProjectNotifier, StagiaireProject>(
  StagiaireProjectNotifier.new,
);

class StagiaireProjectNotifier extends AsyncNotifier<StagiaireProject> {
  @override
  Future<StagiaireProject> build() {
    return ref.read(getStagiaireProjectUseCaseProvider).call();
  }
}
