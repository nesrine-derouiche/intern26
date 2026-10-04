import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/stagiaire/data/stagiaire_overview_repository_impl.dart';
import '../../features/stagiaire/domain/stagiaire_overview_repository.dart';
import '../../features/stagiaire/domain/usecases/get_stagiaire_overview_usecase.dart';
import '../../models/stagiaire_overview.dart';
import '../../services/stagiaire_overview_service.dart';
import '../core/api_client_provider.dart';

final stagiaireOverviewServiceProvider = Provider<StagiaireOverviewService>(
  (ref) => StagiaireOverviewService(ref.watch(dioProvider)),
);

final stagiaireOverviewRepositoryProvider = Provider<StagiaireOverviewRepository>(
  (ref) => StagiaireOverviewRepositoryImpl(
    ref.watch(stagiaireOverviewServiceProvider),
  ),
);

final getStagiaireOverviewUseCaseProvider = Provider<GetStagiaireOverviewUseCase>(
  (ref) => GetStagiaireOverviewUseCase(
    ref.watch(stagiaireOverviewRepositoryProvider),
  ),
);

final stagiaireOverviewProvider =
    AsyncNotifierProvider<StagiaireOverviewNotifier, StagiaireOverview>(
  StagiaireOverviewNotifier.new,
);

class StagiaireOverviewNotifier extends AsyncNotifier<StagiaireOverview> {
  @override
  Future<StagiaireOverview> build() {
    return ref.read(getStagiaireOverviewUseCaseProvider).call();
  }
}
