import '../../../../models/stagiaire_overview.dart';
import '../stagiaire_overview_repository.dart';

class GetStagiaireOverviewUseCase {
  GetStagiaireOverviewUseCase(this._repository);

  final StagiaireOverviewRepository _repository;

  Future<StagiaireOverview> call() => _repository.getOverview();
}
