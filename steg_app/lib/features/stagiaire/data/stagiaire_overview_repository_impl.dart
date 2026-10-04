import '../../../models/stagiaire_overview.dart';
import '../../../services/stagiaire_overview_service.dart';
import '../domain/stagiaire_overview_repository.dart';

class StagiaireOverviewRepositoryImpl implements StagiaireOverviewRepository {
  StagiaireOverviewRepositoryImpl(this._service);

  final StagiaireOverviewService _service;

  @override
  Future<StagiaireOverview> getOverview() => _service.getOverview();
}
