import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/models/stagiaire_project.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_project_provider.dart';
import 'package:steg_app/screens/stagiaire/stagiaire_project_screen.dart';
import 'package:steg_app/widgets/common/error_view.dart';

const _sampleProject = StagiaireProject(
  project: ProjectDetail(
    id: 'p1',
    titre: 'Projet Test',
    description: 'Description du projet',
    technologies: 'Flutter, Dart',
    etat: 'EN_COURS',
    avancement: 45,
    supervisor: ProjectSupervisor(id: 's1', fullName: 'Ahmed Bensalah'),
    departement: 'Informatique',
  ),
  stage: ProjectStage(
    id: 'st1',
    statut: 'EN_COURS',
  ),
  tasks: ProjectTaskStats(
    total: 8,
    todo: 3,
    inProgress: 2,
    completed: 2,
    blocked: 1,
    overdue: 0,
  ),
);

class FakeStagiaireProjectNotifier extends StagiaireProjectNotifier {
  StagiaireProject? _project;
  Object? _error;

  void returnsProject(StagiaireProject project) => _project = project;
  void setError(Object error) => _error = error;

  @override
  Future<StagiaireProject> build() async {
    if (_error != null) throw _error!;
    return _project ?? _sampleProject;
  }
}

Widget buildTestApp({
  StagiaireProject? project,
  Object? error,
}) {
  final notifier = FakeStagiaireProjectNotifier();
  if (project != null) notifier.returnsProject(project);
  if (error != null) notifier.setError(error);

  return ProviderScope(
    overrides: [
      stagiaireProjectProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: RoutePaths.monProjet,
        routes: [
          GoRoute(
            path: RoutePaths.monProjet,
            builder: (context, state) => const StagiaireProjectScreen(),
          ),
        ],
      ),
    ),
  );
}

void main() {
  group('StagiaireProjectScreen', () {
    testWidgets('shows skeleton while loading', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();
      expect(find.byType(SizedBox), findsWidgets);
    });

    testWidgets('shows error state with retry button', (tester) async {
      await tester.pumpWidget(buildTestApp(error: Exception('Network error')));
      await tester.pumpAndSettle();
      expect(find.byType(ErrorView), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
    });

    testWidgets('shows project header with title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Projet Test'), findsOneWidget);
      expect(find.text('Mon projet'), findsOneWidget);
    });

    testWidgets('shows project description', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Description du projet'), findsOneWidget);
    });

    testWidgets('shows supervisor name', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Ahmed Bensalah'), findsOneWidget);
    });

    testWidgets('shows technologies', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Flutter'), findsOneWidget);
      expect(find.text('Dart'), findsOneWidget);
    });

    testWidgets('shows task stats total count', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Tâches du projet'), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
    });

    testWidgets('shows stage info', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Stage associé'), findsOneWidget);
    });

    testWidgets('shows progress percentage', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('45%'), findsOneWidget);
    });

    testWidgets('shows empty state when no project', (tester) async {
      await tester.pumpWidget(buildTestApp(
        project: const StagiaireProject(
          project: ProjectDetail.empty(),
          stage: ProjectStage.empty(),
          tasks: ProjectTaskStats.empty(),
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Aucun projet'), findsOneWidget);
    });

    testWidgets('shows department in header', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Informatique'), findsOneWidget);
    });
  });
}
