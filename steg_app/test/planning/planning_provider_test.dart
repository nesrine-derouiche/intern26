import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/network/api_exception.dart';
import 'package:steg_app/features/planning/data/planning_repository_impl.dart';
import 'package:steg_app/features/planning/domain/planning_repository.dart';
import 'package:steg_app/features/planning/domain/usecases/get_planning_usecase.dart';
import 'package:steg_app/models/planning.dart';
import 'package:steg_app/providers/core/api_client_provider.dart';
import 'package:steg_app/providers/planning/planning_provider.dart';
import 'package:steg_app/services/planning_service.dart';

class FakePlanningRepository implements PlanningRepository {
  FakePlanningRepository({List<PlanningEvent>? events}) : events = events ?? [];

  List<PlanningEvent> events;
  final List<Map<String, dynamic>> calls = [];
  bool shouldFail = false;
  ApiException error = const ApiException(401, 'Token invalide');
  Completer<void>? gate;

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

    final pendingGate = gate;
    if (pendingGate != null) {
      await pendingGate.future;
    }

    if (shouldFail) throw error;

    return Planning(
      stageId: stageId,
      evenements: events,
      pagination: PlanningPagination(
        page: page,
        limit: limit,
        total: events.length,
        pages: events.isEmpty ? 0 : 1,
      ),
    );
  }
}

PlanningEvent event(
  String id, {
  PlanningEventType type = PlanningEventType.reunion,
}) {
  return PlanningEvent(
    id: id,
    type: type,
    title: 'Événement $id',
    date: '2026-07-22',
    time: '10:00',
  );
}

Duration? Function(int retryCount, Object error) get _noRetry =>
    (retryCount, error) => null;

({ProviderContainer container, FakePlanningRepository repository}) buildContainer({
  FakePlanningRepository? repository,
  bool autoRetry = true,
}) {
  final fake = repository ?? FakePlanningRepository();
  final container = ProviderContainer(
    overrides: [planningRepositoryProvider.overrideWithValue(fake)],
    retry: autoRetry ? null : _noRetry,
  );
  addTearDown(container.dispose);
  return (container: container, repository: fake);
}

void main() {
  group('planningProvider — couche provider', () {
    test('wires service, repository and use case providers', () {
      final container = ProviderContainer(
        overrides: [dioProvider.overrideWithValue(Dio())],
      );
      addTearDown(container.dispose);

      expect(container.read(planningServiceProvider), isA<PlanningService>());
      expect(
        container.read(planningRepositoryProvider),
        isA<PlanningRepositoryImpl>(),
      );
      expect(
        container.read(getPlanningUseCaseProvider),
        isA<GetPlanningUseCase>(),
      );
    });
  });

  group('planningProvider — chargement initial', () {
    test('loads with the default period, stage and pagination', () async {
      final built = buildContainer(
        repository: FakePlanningRepository(events: [event('e1')]),
      );

      final planning = await built.container.read(planningProvider.future);

      expect(built.repository.calls, hasLength(1));
      expect(built.repository.calls.single, <String, dynamic>{
        'stage_id': null,
        'date_debut': null,
        'date_fin': null,
        'page': 1,
        'limit': 100,
      });
      expect(planning.evenements.single.id, 'e1');
      expect(built.container.read(planningProvider).hasValue, isTrue);
      expect(built.container.read(planningProvider).isLoading, isFalse);
      expect(built.container.read(planningProvider).hasError, isFalse);
    });

    test('load() re-fetches with the current parameters', () async {
      final built = buildContainer(
        repository: FakePlanningRepository(events: [event('e1')]),
      );
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.load();

      expect(built.repository.calls, hasLength(2));
      expect(built.repository.calls.last, built.repository.calls.first);
    });
  });

  group('planningProvider — période', () {
    test('setPeriod reloads with the new period and resets the page', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPage(4);
      await notifier.setPeriod(dateDebut: '2026-06-01', dateFin: '2026-06-30');

      final last = built.repository.calls.last;
      expect(last['date_debut'], '2026-06-01');
      expect(last['date_fin'], '2026-06-30');
      expect(last['page'], 1);
      expect(last['stage_id'], isNull);
      expect(notifier.dateDebut, '2026-06-01');
      expect(notifier.dateFin, '2026-06-30');
      expect(notifier.page, 1);
      expect(built.container.read(planningProvider).value, isNotNull);
    });

    test('setPeriod without arguments clears the period', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPeriod(dateDebut: '2026-06-01', dateFin: '2026-06-30');
      await notifier.setPeriod();

      final last = built.repository.calls.last;
      expect(last['date_debut'], isNull);
      expect(last['date_fin'], isNull);
      expect(notifier.dateDebut, isNull);
      expect(notifier.dateFin, isNull);
    });
  });

  group('planningProvider — stage', () {
    test('setStage reloads with the stage and resets the page', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPage(3);
      await notifier.setStage('stage-9');

      final last = built.repository.calls.last;
      expect(last['stage_id'], 'stage-9');
      expect(last['page'], 1);
      expect(notifier.stageId, 'stage-9');
      expect(notifier.page, 1);
    });

    test('setStage(null) clears the stage filter', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setStage('stage-9');
      await notifier.setStage(null);

      expect(built.repository.calls.last['stage_id'], isNull);
      expect(notifier.stageId, isNull);
    });
  });

  group('planningProvider — page et limit', () {
    test('setPage reloads with the requested page', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPage(3);

      expect(built.repository.calls.last['page'], 3);
      expect(notifier.page, 3);
      expect(built.container.read(planningProvider).value!.pagination.page, 3);
    });

    test('setPage below 1 falls back to the first page', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPage(0);

      expect(built.repository.calls.last['page'], 1);
      expect(notifier.page, 1);
    });

    test('setLimit reloads with the requested limit', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setLimit(25);

      expect(built.repository.calls.last['limit'], 25);
      expect(notifier.limit, 25);
    });
  });

  group('planningProvider — refresh et retry', () {
    test('refresh re-fetches with the same parameters', () async {
      final built = buildContainer();
      final notifier = built.container.read(planningProvider.notifier);

      await built.container.read(planningProvider.future);
      await notifier.setPeriod(dateDebut: '2026-06-01', dateFin: '2026-06-30');
      final before = Map<String, dynamic>.of(built.repository.calls.last);

      await notifier.refresh();

      expect(built.repository.calls, hasLength(3));
      expect(built.repository.calls.last, before);
      expect(built.container.read(planningProvider).hasValue, isTrue);
    });

    test('retry recovers from a failed load', () async {
      final repository = FakePlanningRepository(events: [event('e1')])
        ..shouldFail = true;
      final built = buildContainer(repository: repository, autoRetry: false);
      final notifier = built.container.read(planningProvider.notifier);

      await expectLater(
        built.container.read(planningProvider.future),
        throwsA(isA<ApiException>()),
      );
      expect(built.container.read(planningProvider).hasError, isTrue);

      repository.shouldFail = false;
      await notifier.retry();

      final state = built.container.read(planningProvider);
      expect(state.hasValue, isTrue);
      expect(state.hasError, isFalse);
      expect(state.value!.evenements.single.id, 'e1');
      expect(built.repository.calls, hasLength(2));
    });
  });

  group('planningProvider — états', () {
    test('exposes a loading state while a reload is running', () async {
      final built = buildContainer(
        repository: FakePlanningRepository(events: [event('e1')]),
      );
      final notifier = built.container.read(planningProvider.notifier);
      await built.container.read(planningProvider.future);

      final gate = Completer<void>();
      built.repository.gate = gate;
      final pending = notifier.setPage(2);

      expect(built.container.read(planningProvider).isLoading, isTrue);
      expect(built.container.read(planningProvider).hasValue, isTrue);

      gate.complete();
      await pending;

      final state = built.container.read(planningProvider);
      expect(state.isLoading, isFalse);
      expect(state.hasValue, isTrue);
      expect(state.value!.pagination.page, 2);
    });

    test('exposes an error state with the backend message', () async {
      final repository = FakePlanningRepository()..shouldFail = true;
      final built = buildContainer(repository: repository, autoRetry: false);

      await expectLater(
        built.container.read(planningProvider.future),
        throwsA(isA<ApiException>()),
      );

      final state = built.container.read(planningProvider);
      expect(state.hasError, isTrue);
      expect(state.isLoading, isFalse);
      expect(state.error, isA<ApiException>());
      final apiError = state.error! as ApiException;
      expect(apiError.statusCode, 401);
      expect(apiError.message, 'Token invalide');
      expect(apiError.isUnauthorized, isTrue);
      expect(built.container.read(planningIsEmptyProvider), isFalse);
    });

    test('exposes an empty state when the planning has no event', () async {
      final built = buildContainer(repository: FakePlanningRepository());

      final planning = await built.container.read(planningProvider.future);

      expect(planning.evenements, isEmpty);
      expect(planning.pagination.total, 0);
      expect(built.container.read(planningIsEmptyProvider), isTrue);
    });

    test('planningIsEmptyProvider is false when there are events', () async {
      final built = buildContainer(
        repository: FakePlanningRepository(events: [event('e1')]),
      );

      await built.container.read(planningProvider.future);

      expect(built.container.read(planningIsEmptyProvider), isFalse);
    });
  });
}
