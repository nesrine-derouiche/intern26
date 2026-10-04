import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/date_utils.dart';
import '../../mappers/planning_event_mapper.dart';
import '../../models/planning.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/planning/planning_provider.dart';
import '../../widgets/calendar/calendar_event_tile.dart';
import '../../widgets/calendar/calendar_helpers.dart';
import '../../widgets/calendar/calendar_skeleton.dart';
import '../../widgets/calendar/month_grid.dart';
import '../../widgets/calendar/week_strip.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

enum PlanningView { month, week }

class PlanningScreen extends ConsumerStatefulWidget {
  const PlanningScreen({super.key});

  @override
  ConsumerState<PlanningScreen> createState() => _PlanningScreenState();
}

class _PlanningScreenState extends ConsumerState<PlanningScreen> {
  PlanningView _view = PlanningView.month;
  late DateTime _anchor;
  late DateTime _selected;
  String? _stageId;
  final Set<PlanningEventType> _hiddenTypes = <PlanningEventType>{};

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _anchor = DateTime(today.year, today.month, today.day);
    _selected = _anchor;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncPeriod();
    });
  }

  (DateTime, DateTime) get _period {
    if (_view == PlanningView.month) {
      return (
        DateTime(_anchor.year, _anchor.month, 1),
        DateTime(_anchor.year, _anchor.month + 1, 0),
      );
    }
    final start = startOfWeek(_anchor);
    return (start, start.add(const Duration(days: 6)));
  }

  String get _periodLabel {
    final (start, end) = _period;
    if (_view == PlanningView.month) {
      return '${monthNamesFr[start.month - 1]} ${start.year}';
    }
    return 'Semaine du ${start.day}/${start.month} au ${end.day}/${end.month}';
  }

  String _ymd(DateTime date) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${date.year}-${two(date.month)}-${two(date.day)}';
  }

  void _syncPeriod() {
    final (start, end) = _period;
    ref.read(planningProvider.notifier).setPeriod(
          dateDebut: _ymd(start),
          dateFin: _ymd(end),
        );
  }

  void _previousPeriod() {
    setState(() {
      if (_view == PlanningView.month) {
        _anchor = DateTime(_anchor.year, _anchor.month - 1, 1);
      } else {
        _anchor = _anchor.subtract(const Duration(days: 7));
      }
      _selected = _anchor;
    });
    _syncPeriod();
  }

  void _nextPeriod() {
    setState(() {
      if (_view == PlanningView.month) {
        _anchor = DateTime(_anchor.year, _anchor.month + 1, 1);
      } else {
        _anchor = _anchor.add(const Duration(days: 7));
      }
      _selected = _anchor;
    });
    _syncPeriod();
  }

  void _goToday() {
    final today = DateTime.now();
    setState(() {
      _anchor = DateTime(today.year, today.month, today.day);
      _selected = _anchor;
    });
    _syncPeriod();
  }

  void _setView(PlanningView view) {
    if (view == _view) return;
    setState(() => _view = view);
    _syncPeriod();
  }

  void _toggleType(PlanningEventType type) {
    setState(() {
      if (!_hiddenTypes.remove(type)) _hiddenTypes.add(type);
    });
  }

  void _setStage(String? stageId) {
    final normalized =
        (stageId == null || stageId.isEmpty) ? null : stageId;
    setState(() => _stageId = normalized);
    ref.read(planningProvider.notifier).setStage(normalized);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value?.session?.user;
    final planningAsync = ref.watch(planningProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Planning'),
        actions: [
          TextButton.icon(
            onPressed: _goToday,
            icon: const Icon(Icons.today_outlined, size: 18),
            label: const Text("Aujourd'hui"),
          ),
          IconButton(
            tooltip: 'Rafraîchir',
            onPressed: () => ref.read(planningProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _buildBody(user, planningAsync),
    );
  }

  Widget _buildBody(User? user, AsyncValue<Planning> planningAsync) {
    if (user?.role != 'STAGIAIRE') {
      return const EmptyState(
        icon: Icons.event_note_outlined,
        title: 'Planning indisponible',
        message: 'Ce planning est réservé aux stagiaires.',
      );
    }

    if (planningAsync.hasError && !planningAsync.hasValue) {
      return ErrorView(
        message: planningAsync.error.toString(),
        onRetry: () => ref.read(planningProvider.notifier).retry(),
      );
    }

    if (planningAsync.isLoading && !planningAsync.hasValue) {
      return const CalendarSkeleton();
    }

    final planning = planningAsync.value ?? const Planning();
    final notifier = ref.read(planningProvider.notifier);

    final stageIds = <String>{
      if (_stageId != null && _stageId!.isNotEmpty) _stageId!,
      if (planning.stageId != null && planning.stageId!.isNotEmpty)
        planning.stageId!,
      for (final stage in planning.stages)
        if (stage.id.isNotEmpty) stage.id,
    }.toList();

    final events = PlanningEventMapper.toCalendarEvents(
      planning.evenements.where((e) => !_hiddenTypes.contains(e.type)),
    );
    final eventsByDay = groupEventsByDay(events);

    final (periodStart, periodEnd) = _period;
    final visibleEvents = events.where((event) {
      final day = event.day;
      if (day == null) return false;
      return !day.isBefore(dateOnly(periodStart)) &&
          !day.isAfter(dateOnly(periodEnd));
    }).toList()
      ..sort((a, b) {
        final byDate = (a.date ?? DateTime(2100)).compareTo(b.date ?? DateTime(2100));
        if (byDate != 0) return byDate;
        return (a.time ?? '').compareTo(b.time ?? '');
      });

    final pagination = planning.pagination;

    return RefreshIndicator(
      onRefresh: () => ref.read(planningProvider.notifier).refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Center(
            child: SegmentedButton<PlanningView>(
              segments: const [
                ButtonSegment(
                  value: PlanningView.month,
                  icon: Icon(Icons.calendar_view_month_outlined, size: 18),
                  label: Text('Mois'),
                ),
                ButtonSegment(
                  value: PlanningView.week,
                  icon: Icon(Icons.view_week_outlined, size: 18),
                  label: Text('Semaine'),
                ),
              ],
              selected: {_view},
              onSelectionChanged: (selection) => _setView(selection.first),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              IconButton(
                tooltip: 'Période précédente',
                onPressed: _previousPeriod,
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Center(
                  child: Text(
                    _periodLabel,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Période suivante',
                onPressed: _nextPeriod,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          if (stageIds.isNotEmpty) ...[
            const SizedBox(height: 4),
            DropdownButton<String>(
              value: _stageId ?? '',
              isExpanded: true,
              hint: const Text('Tous les stages'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Tous les stages')),
                for (final id in stageIds)
                  DropdownMenuItem(value: id, child: Text(id)),
              ],
              onChanged: _setStage,
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final type in PlanningEventType.values)
                FilterChip(
                  label: Text(PlanningEventMapper.mapType(type).label),
                  avatar: Icon(
                    PlanningEventMapper.mapType(type).icon,
                    size: 16,
                    color: PlanningEventMapper.mapType(type).color,
                  ),
                  selected: !_hiddenTypes.contains(type),
                  onSelected: (_) => _toggleType(type),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_view == PlanningView.month)
            MonthGrid(
              month: DateTime(_anchor.year, _anchor.month, 1),
              selected: _selected,
              eventsByDay: eventsByDay,
              onSelect: (date) => setState(() => _selected = date),
            )
          else
            WeekStrip(
              startOfWeek: startOfWeek(_anchor),
              selected: _selected,
              eventsByDay: eventsByDay,
              onSelect: (date) => setState(() => _selected = date),
            ),
          const SizedBox(height: 16),
          if (visibleEvents.isEmpty)
            const EmptyState(
              icon: Icons.event_busy_outlined,
              title: 'Aucun événement',
              message: 'Aucun événement pour cette période.',
            )
          else
            for (final event in visibleEvents) ...[
              CalendarEventTile(event: event),
              const SizedBox(height: 8),
            ],
          if (pagination.pages > 1) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton(
                  onPressed:
                      pagination.page > 1 ? () => notifier.setPage(pagination.page - 1) : null,
                  child: const Text('Précédent'),
                ),
                const SizedBox(width: 12),
                Text(
                  'Page ${pagination.page} / ${pagination.pages}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: pagination.hasNextPage
                      ? () => notifier.setPage(pagination.page + 1)
                      : null,
                  child: const Text('Suivant'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
