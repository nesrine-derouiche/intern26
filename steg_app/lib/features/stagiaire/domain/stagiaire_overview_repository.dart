import '../../../models/stagiaire_overview.dart';

abstract interface class StagiaireOverviewRepository {
  Future<StagiaireOverview> getOverview();
}
