import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/stagiaire/domain/stagiaire_overview_repository.dart';
import 'package:steg_app/models/stagiaire_overview.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';

class FakeStagiaireOverviewRepository implements StagiaireOverviewRepository {
  FakeStagiaireOverviewRepository({this.overview});

  StagiaireOverview? overview;
  int callCount = 0;

  @override
  Future<StagiaireOverview> getOverview() async {
    callCount++;
    return overview ?? const StagiaireOverview(
      tasks: OverviewTaskStats(
        total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: [],
      ),
      upcomingMeetings: [],
    );
  }
}

void main() {
  ProviderContainer containerWith(FakeStagiaireOverviewRepository repository) {
    final container = ProviderContainer(
      overrides: [
        stagiaireOverviewRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('StagiaireOverview model', () {
    test('parses full overview from JSON', () {
      final overview = StagiaireOverview.fromJson({
        'trainee': {'id': 'u1', 'nom': 'Trabelsi', 'prenom': 'Fatma', 'email': 'fatma@steg.tn'},
        'internship': {
          'id': 's1',
          'title': 'Developpeur Angular',
          'start_date': '2026-01-15',
          'end_date': '2026-07-15',
          'status': 'EN_COURS',
          'supervisor': {'id': 'e1', 'full_name': 'Ahmed Ben Salah'},
        },
        'project': {'id': 'p1', 'titre': 'Dashboard', 'description': 'App web', 'avancement': 65},
        'tasks': {
          'total': 4, 'todo': 1, 'in_progress': 1, 'completed': 2, 'overdue': 0,
          'next': [
            {'id': 't1', 'titre': 'CRUD Stagiaires', 'priorite': 'MOYENNE', 'date_fin': '2026-08-01', 'statut': 'EN_COURS'},
          ],
        },
        'upcoming_meetings': [
          {'id': 'r1', 'date': '2026-07-22', 'heure': '10:00', 'sujet': 'Point avancement', 'salle': 'B204', 'lien_visio': null},
        ],
        'journal': {'total': 2, 'submitted': 1, 'pending': 1},
        'evaluation': {'id': 'ev1', 'note_finale': 16.4, 'validee': true},
      });

      expect(overview.trainee?.fullName, 'Fatma Trabelsi');
      expect(overview.internship?.title, 'Developpeur Angular');
      expect(overview.internship?.status, 'EN_COURS');
      expect(overview.internship?.supervisor?.fullName, 'Ahmed Ben Salah');
      expect(overview.project?.titre, 'Dashboard');
      expect(overview.tasks.total, 4);
      expect(overview.tasks.todo, 1);
      expect(overview.tasks.inProgress, 1);
      expect(overview.tasks.completed, 2);
      expect(overview.tasks.next.length, 1);
      expect(overview.upcomingMeetings.length, 1);
      expect(overview.journal?.total, 2);
      expect(overview.evaluation?.noteFinale, 16.4);
      expect(overview.hasStage, isTrue);
    });

    test('parses empty/null optional fields safely', () {
      final overview = StagiaireOverview.fromJson({
        'trainee': null,
        'internship': null,
        'project': null,
        'tasks': {},
        'upcoming_meetings': null,
        'journal': null,
        'evaluation': null,
      });

      expect(overview.trainee, isNull);
      expect(overview.internship, isNull);
      expect(overview.project, isNull);
      expect(overview.tasks.total, 0);
      expect(overview.tasks.next, isEmpty);
      expect(overview.upcomingMeetings, isEmpty);
      expect(overview.journal, isNull);
      expect(overview.evaluation, isNull);
      expect(overview.hasStage, isFalse);
    });

    test('asInternship converts overview to Internship model', () {
      final overview = StagiaireOverview.fromJson({
        'trainee': {'id': 'u1', 'nom': 'Trabelsi', 'prenom': 'Fatma', 'email': 'f@steg.tn'},
        'internship': {
          'id': 's1',
          'title': 'Angular Dev',
          'start_date': '2026-01-15',
          'end_date': '2026-07-15',
          'status': 'EN_COURS',
          'supervisor': {'id': 'e1', 'full_name': 'Ahmed Ben Salah'},
        },
        'tasks': {},
        'upcoming_meetings': [],
      });

      final internship = overview.asInternship;
      expect(internship, isNotNull);
      expect(internship!.id, 's1');
      expect(internship.offreTitre, 'Angular Dev');
      expect(internship.encadrantNom, 'Ahmed Ben Salah');
      expect(internship.stagiairePrenom, 'Fatma');
    });

    test('asInternship is null when no internship', () {
      const overview = StagiaireOverview(
        tasks: OverviewTaskStats(total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: []),
        upcomingMeetings: [],
      );
      expect(overview.asInternship, isNull);
    });
  });

  group('stagiaireOverviewProvider', () {
    test('loads overview from repository', () async {
      final repository = FakeStagiaireOverviewRepository(
        overview: StagiaireOverview.fromJson({
          'trainee': {'id': 'u1', 'nom': 'Trabelsi', 'prenom': 'Fatma', 'email': 'f@steg.tn'},
          'tasks': {'total': 3, 'todo': 1, 'in_progress': 1, 'completed': 1, 'overdue': 0, 'next': []},
          'upcoming_meetings': [],
        }),
      );
      final container = containerWith(repository);

      final overview = await container.read(stagiaireOverviewProvider.future);
      expect(overview.trainee?.nom, 'Trabelsi');
      expect(overview.tasks.total, 3);
      expect(repository.callCount, 1);
    });

    test('empty overview from repository is handled safely', () async {
      final repository = FakeStagiaireOverviewRepository(
        overview: const StagiaireOverview(
          tasks: OverviewTaskStats(total: 0, todo: 0, inProgress: 0, completed: 0, overdue: 0, next: []),
          upcomingMeetings: [],
        ),
      );
      final container = containerWith(repository);

      final overview = await container.read(stagiaireOverviewProvider.future);
      expect(overview.hasStage, isFalse);
      expect(overview.tasks.total, 0);
      expect(overview.upcomingMeetings, isEmpty);
    });

    test('refresh reloads data from repository', () async {
      final repository = FakeStagiaireOverviewRepository(
        overview: StagiaireOverview.fromJson({
          'tasks': {'total': 1, 'todo': 0, 'in_progress': 0, 'completed': 1, 'overdue': 0, 'next': []},
          'upcoming_meetings': [],
        }),
      );
      final container = containerWith(repository);

      await container.read(stagiaireOverviewProvider.future);
      expect(repository.callCount, 1);

      await container.read(stagiaireOverviewProvider.notifier).build();
      expect(repository.callCount, 2);
    });

    test('default overview has zeroed task counts when no data', () async {
      final repository = FakeStagiaireOverviewRepository();
      final container = containerWith(repository);

      final overview = await container.read(stagiaireOverviewProvider.future);
      expect(overview.tasks.total, 0);
      expect(overview.tasks.todo, 0);
      expect(overview.tasks.inProgress, 0);
      expect(overview.tasks.completed, 0);
      expect(overview.tasks.overdue, 0);
      expect(overview.tasks.next, isEmpty);
      expect(overview.upcomingMeetings, isEmpty);
    });
  });
}
