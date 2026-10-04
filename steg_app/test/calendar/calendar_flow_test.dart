import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:go_router/go_router.dart';
import 'package:steg_app/core/routing/route_paths.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/stagiaire_calendar_event.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_calendar_provider.dart';
import 'package:steg_app/screens/calendar/calendar_screen.dart';
import 'package:steg_app/services/stagiaire_calendar_service.dart';
import 'package:steg_app/widgets/calendar/calendar_legend.dart';
import 'package:steg_app/widgets/calendar/month_grid.dart';
import 'package:steg_app/widgets/calendar/week_strip.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

String ymd(DateTime date) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${date.year}-${two(date.month)}-${two(date.day)}';
}

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(dynamic request) async =>
      throw UnimplementedError();

  @override
  Future<void> logout() async => session = null;
}

class FakeStagiaireCalendarService implements StagiaireCalendarService {
  FakeStagiaireCalendarService({required this.events});

  final List<StagiaireCalendarEvent> events;

  @override
  Future<List<StagiaireCalendarEvent>> getCalendarEvents() async =>
      List.of(events);
}

List<StagiaireCalendarEvent> buildCalendarEvents(DateTime today) {
  final end = today.add(const Duration(days: 10));
  return [
    StagiaireCalendarEvent(
      id: 'stage-debut-s1',
      type: StagiaireCalendarEventType.internship,
      title: 'Début du stage',
      date: today,
      status: 'EN_COURS',
      resourceId: 's1',
    ),
    StagiaireCalendarEvent(
      id: 'stage-fin-s1',
      type: StagiaireCalendarEventType.internship,
      title: 'Fin du stage',
      date: end,
      status: 'EN_COURS',
      resourceId: 's1',
    ),
    StagiaireCalendarEvent(
      id: 'reunion-r1',
      type: StagiaireCalendarEventType.meeting,
      title: 'Point projet',
      date: today.add(const Duration(days: 3)),
      time: '10:30:00',
      status: null,
      resourceId: 'r1',
    ),
    StagiaireCalendarEvent(
      id: 'tache-t1',
      type: StagiaireCalendarEventType.task,
      title: 'Valider le module',
      date: today.add(const Duration(days: 5)),
      status: 'EN_COURS',
      resourceId: 't1',
    ),
  ];
}

ProviderScope buildApp({
  required FakeAuthRepository auth,
  required List<StagiaireCalendarEvent> calendarEvents,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      stagiaireCalendarServiceProvider.overrideWithValue(
        FakeStagiaireCalendarService(events: calendarEvents),
      ),
    ],
    child: MaterialApp.router(
      routerConfig: GoRouter(
        initialLocation: RoutePaths.calendrier,
        routes: [
          GoRoute(
            path: RoutePaths.calendrier,
            builder: (context, state) => const CalendarScreen(),
          ),
          GoRoute(
            path: '/',
            builder: (context, state) => const Scaffold(),
          ),
        ],
      ),
    ),
  );
}

void main() {
  final today = DateTime.now();

  testWidgets('renders month view with event dots and legend', (tester) async {
    tester.view.physicalSize = const Size(1000, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        calendarEvents: buildCalendarEvents(today),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CalendarScreen), findsOneWidget);
    expect(find.byType(MonthGrid), findsOneWidget);
    expect(find.byType(CalendarLegend), findsOneWidget);

    // Today's stage debut event shows as a tile on the selected day
    expect(find.text('Début du stage'), findsWidgets);
    // Legend shows all event type labels
    expect(find.text('Réunion'), findsOneWidget);
    expect(find.text('Échéance tâche'), findsOneWidget);
    expect(find.text('Fin du stage'), findsOneWidget);
  });

  testWidgets('switches to week view', (tester) async {
    tester.view.physicalSize = const Size(1000, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        calendarEvents: buildCalendarEvents(today),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(MonthGrid), findsOneWidget);

    await tester.tap(find.text('Semaine'));
    await tester.pumpAndSettle();

    expect(find.byType(MonthGrid), findsNothing);
    expect(find.byType(WeekStrip), findsOneWidget);
  });

  testWidgets('shows selected day events', (tester) async {
    tester.view.physicalSize = const Size(1000, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        calendarEvents: buildCalendarEvents(today),
      ),
    );
    await tester.pumpAndSettle();

    // Today is selected by default, stage debut is today
    expect(find.text('Début du stage'), findsWidgets);
    expect(
      find.textContaining(
        '${today.day}/${today.month.toString().padLeft(2, '0')}',
      ),
      findsWidgets,
    );
  });

  testWidgets('blocks non-stagiaire roles', (tester) async {
    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        calendarEvents: [],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Calendrier indisponible'), findsOneWidget);
  });

  testWidgets('shows empty state when no events', (tester) async {
    tester.view.physicalSize = const Size(1000, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        calendarEvents: [],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CalendarScreen), findsOneWidget);
    expect(find.text('Aucun événement ce jour.'), findsOneWidget);
  });
}
