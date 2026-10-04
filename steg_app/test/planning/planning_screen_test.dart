import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/core/routing/app_router.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/planning/domain/planning_repository.dart';
import 'package:steg_app/models/planning.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/onboarding/document_onboarding_provider.dart';
import 'package:steg_app/providers/planning/planning_provider.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/home/home_screen.dart';
import 'package:steg_app/screens/planning/planning_screen.dart';
import 'package:steg_app/widgets/calendar/calendar_helpers.dart';
import 'package:steg_app/widgets/calendar/month_grid.dart';
import 'package:steg_app/widgets/calendar/week_strip.dart';

import '../helpers/fake_stagiaire_overview_repository.dart';
import '../onboarding/onboarding_utils.dart';

class FakePlanningRepository implements PlanningRepository {
  FakePlanningRepository({
    List<PlanningEvent>? events,
    List<String> stageIds = const [],
    this.pages = 1,
  })  : events = events ?? <PlanningEvent>[],
        stageIds = List<String>.of(stageIds);

  List<PlanningEvent> events;
  List<String> stageIds;
  int pages;
  bool shouldFail = false;
  final List<Map<String, dynamic>> calls = <Map<String, dynamic>>[];

  @override
  Future<Planning> getPlanning({
    String? stageId,
    String? dateDebut,
    String? dateFin,
    int page = 1,
    int limit = 100,
  }) async {
    calls.add(<String, dynamic>{
      'stage_id': stageId,
      'date_debut': dateDebut,
      'date_fin': dateFin,
      'page': page,
      'limit': limit,
    });
    if (shouldFail) throw const ApiException(500, 'Erreur serveur');

    return Planning(
      stageId: stageIds.isEmpty ? null : stageIds.first,
      stages: [for (final id in stageIds) PlanningStage(id: id)],
      evenements: events,
      pagination: PlanningPagination(
        page: page,
        limit: limit,
        total: events.length,
        pages: pages,
      ),
    );
  }
}

String ymd(DateTime date) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${date.year}-${two(date.month)}-${two(date.day)}';
}

List<PlanningEvent> buildEvents(DateTime today) {
  return [
    PlanningEvent(
      id: 'e1',
      type: PlanningEventType.stageStart,
      title: 'Ouverture du stage',
      date: ymd(today),
    ),
    PlanningEvent(
      id: 'e2',
      type: PlanningEventType.stageEnd,
      title: 'Clôture du stage',
      date: ymd(today),
    ),
    PlanningEvent(
      id: 'e3',
      type: PlanningEventType.reunion,
      title: 'Point hebdo',
      date: ymd(today),
      time: '10:00',
    ),
    PlanningEvent(
      id: 'e4',
      type: PlanningEventType.taskDeadline,
      title: 'Rapport à rendre',
      date: ymd(today),
    ),
    PlanningEvent(
      id: 'e5',
      type: PlanningEventType.pointageEntree,
      title: 'Entrée atelier',
      date: ymd(today),
      time: '08:30',
    ),
    PlanningEvent(
      id: 'e6',
      type: PlanningEventType.pointageSortie,
      title: 'Sortie atelier',
      date: ymd(today),
      time: '17:00',
    ),
  ];
}

ProviderScope buildApp({
  required FakeAuthRepository auth,
  required FakePlanningRepository repository,
  Duration? Function(int retryCount, Object error)? retry,
}) {
  return ProviderScope(
    retry: retry,
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      planningRepositoryProvider.overrideWithValue(repository),
    ],
    child: MaterialApp(
      home: const PlanningScreen(),
    ),
  );
}

ProviderScope buildFullApp({
  required FakeAuthRepository auth,
  required FakeOnboardingRepository onboarding,
  required FakePlanningRepository repository,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      onboardingRepositoryProvider.overrideWithValue(onboarding),
      stagiaireOverviewRepositoryProvider.overrideWithValue(
        FakeStagiaireOverviewRepository(),
      ),
      planningRepositoryProvider.overrideWithValue(repository),
    ],
    child: const StegApp(),
  );
}

void main() {
  final today = DateTime.now();

  Future<void> pumpScreen(WidgetTester tester, Widget app) async {
    tester.view.physicalSize = const Size(1000, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(app);
    await tester.pumpAndSettle();
  }

  FakeAuthRepository stagiaireAuth() => FakeAuthRepository(
        session: const AuthSession(accessToken: 'token', user: stagiaire),
      );

  testWidgets('rendu : calendrier mensuel, période courante et 6 types',
      (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.byType(PlanningScreen), findsOneWidget);
    expect(find.byType(MonthGrid), findsOneWidget);
    expect(
      find.text('${monthNamesFr[today.month - 1]} ${today.year}'),
      findsOneWidget,
    );

    // Les 6 types d'événements du planning sont affichés.
    expect(find.text('Ouverture du stage'), findsOneWidget);
    expect(find.text('Clôture du stage'), findsOneWidget);
    expect(find.text('Point hebdo'), findsOneWidget);
    expect(find.text('Rapport à rendre'), findsOneWidget);
    expect(find.text('Entrée atelier'), findsOneWidget);
    expect(find.text('Sortie atelier'), findsOneWidget);

    // Les 6 filtres de type sont présents et sélectionnés par défaut.
    expect(find.widgetWithText(FilterChip, 'Début du stage'), findsOneWidget);
    expect(find.widgetWithText(FilterChip, 'Fin du stage'), findsOneWidget);
    expect(find.widgetWithText(FilterChip, 'Réunion'), findsOneWidget);
    expect(find.widgetWithText(FilterChip, 'Échéance tâche'), findsOneWidget);
    expect(find.widgetWithText(FilterChip, 'Pointage — entrée'), findsOneWidget);
    expect(find.widgetWithText(FilterChip, 'Pointage — sortie'), findsOneWidget);

    // La période courante est envoyée au backend (après le chargement initial).
    expect(
      repository.calls.last['date_debut'],
      ymd(DateTime(today.year, today.month, 1)),
    );
    expect(
      repository.calls.last['date_fin'],
      ymd(DateTime(today.year, today.month + 1, 0)),
    );
  });

  testWidgets('navigation période précédente puis suivante', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    final previous = DateTime(today.year, today.month - 1, 1);
    await tester.tap(find.byTooltip('Période précédente'));
    await tester.pumpAndSettle();

    expect(
      find.text('${monthNamesFr[previous.month - 1]} ${previous.year}'),
      findsOneWidget,
    );
    expect(repository.calls.last['date_debut'], ymd(previous));
    expect(
      repository.calls.last['date_fin'],
      ymd(DateTime(previous.year, previous.month + 1, 0)),
    );

    await tester.tap(find.byTooltip('Période suivante'));
    await tester.pumpAndSettle();

    expect(
      find.text('${monthNamesFr[today.month - 1]} ${today.year}'),
      findsOneWidget,
    );
    expect(repository.calls.last['date_debut'], ymd(DateTime(today.year, today.month, 1)));
  });

  testWidgets('affichage semaine', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.byType(MonthGrid), findsOneWidget);

    await tester.tap(find.text('Semaine'));
    await tester.pumpAndSettle();

    expect(find.byType(MonthGrid), findsNothing);
    expect(find.byType(WeekStrip), findsOneWidget);
    expect(find.textContaining('Semaine du'), findsOneWidget);
    // Les événements de la semaine restent affichés.
    expect(find.text('Point hebdo'), findsOneWidget);
  });

  testWidgets('filtre stage', (tester) async {
    final repository = FakePlanningRepository(
      events: buildEvents(today),
      stageIds: ['stage-1', 'stage-2'],
    );
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.text('Tous les stages'), findsOneWidget);
    expect(repository.calls.last['stage_id'], isNull);

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();

    await tester.tap(find.text('stage-2').last);
    await tester.pumpAndSettle();

    expect(repository.calls.last['stage_id'], 'stage-2');
    expect(find.text('stage-2'), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tous les stages').last);
    await tester.pumpAndSettle();

    expect(repository.calls.last['stage_id'], isNull);
    expect(find.text('Tous les stages'), findsOneWidget);
  });

  testWidgets('filtre type déactive l\'affichage du type', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.text('Point hebdo'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Réunion'));
    await tester.pumpAndSettle();

    expect(find.text('Point hebdo'), findsNothing);
    expect(find.text('Ouverture du stage'), findsOneWidget);
    expect(find.text('Entrée atelier'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Réunion'));
    await tester.pumpAndSettle();

    expect(find.text('Point hebdo'), findsOneWidget);
  });

  testWidgets('état vide', (tester) async {
    final repository = FakePlanningRepository(events: const []);
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.byType(PlanningScreen), findsOneWidget);
    expect(find.byType(MonthGrid), findsOneWidget);
    expect(find.text('Aucun événement'), findsOneWidget);
    expect(find.text('Aucun événement pour cette période.'), findsOneWidget);
  });

  testWidgets('état erreur puis retry', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today))
      ..shouldFail = true;
    await pumpScreen(
      tester,
      buildApp(
        auth: stagiaireAuth(),
        repository: repository,
        retry: (retryCount, error) => null,
      ),
    );

    expect(find.text('Erreur serveur'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
    expect(find.byType(MonthGrid), findsNothing);

    repository.shouldFail = false;
    await tester.tap(find.text('Réessayer'));
    await tester.pumpAndSettle();

    expect(find.text('Erreur serveur'), findsNothing);
    expect(find.byType(MonthGrid), findsOneWidget);
    expect(find.text('Point hebdo'), findsOneWidget);
  });

  testWidgets('refresh recharge les données', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    final before = repository.calls.length;
    await tester.tap(find.byTooltip('Rafraîchir'));
    await tester.pumpAndSettle();

    expect(repository.calls.length, before + 1);
    expect(find.text('Point hebdo'), findsOneWidget);
  });

  testWidgets('pagination : page suivante', (tester) async {
    final repository = FakePlanningRepository(
      events: buildEvents(today),
      pages: 3,
    );
    await pumpScreen(tester, buildApp(auth: stagiaireAuth(), repository: repository));

    expect(find.text('Page 1 / 3'), findsOneWidget);
    expect(repository.calls.last['page'], 1);

    await tester.tap(find.text('Suivant'));
    await tester.pumpAndSettle();

    expect(repository.calls.last['page'], 2);
    expect(find.text('Page 2 / 3'), findsOneWidget);
  });

  testWidgets('CANDIDAT : accès bloqué sur l\'écran', (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(
      tester,
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: candidat),
        ),
        repository: repository,
      ),
    );

    expect(find.text('Planning indisponible'), findsOneWidget);
    expect(find.text('Ce planning est réservé aux stagiaires.'), findsOneWidget);
    expect(find.byType(MonthGrid), findsNothing);
    expect(find.text('Point hebdo'), findsNothing);
  });

  testWidgets('autres rôles : même comportement que le calendrier existant',
      (tester) async {
    final repository = FakePlanningRepository(events: buildEvents(today));
    await pumpScreen(
      tester,
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        repository: repository,
      ),
    );

    expect(find.text('Planning indisponible'), findsOneWidget);
    expect(find.byType(MonthGrid), findsNothing);
  });

  testWidgets('CANDIDAT : la route /planning redirige vers le home',
      (tester) async {
    tester.view.physicalSize = const Size(900, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildFullApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: candidat),
        ),
        onboarding: FakeOnboardingRepository(
          onboarding: buildValidated(),
          access: buildAccess(),
        ),
        repository: FakePlanningRepository(events: buildEvents(today)),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(MaterialApp)),
      listen: false,
    );
    container.read(appRouterProvider).go(RoutePaths.planning);
    await tester.pumpAndSettle();

    expect(find.byType(PlanningScreen), findsNothing);
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
