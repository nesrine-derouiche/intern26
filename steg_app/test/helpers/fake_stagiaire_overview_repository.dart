import 'package:steg_app/features/stagiaire/domain/stagiaire_overview_repository.dart';
import 'package:steg_app/models/stagiaire_overview.dart';

class FakeStagiaireOverviewRepository implements StagiaireOverviewRepository {
  FakeStagiaireOverviewRepository({this.overview});

  final StagiaireOverview? overview;

  static StagiaireOverview get emptyOverview => const StagiaireOverview(
        tasks: OverviewTaskStats(
          total: 0,
          todo: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          next: [],
        ),
        upcomingMeetings: [],
      );

  @override
  Future<StagiaireOverview> getOverview() async =>
      overview ?? emptyOverview;
}
