import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../models/calendar_event.dart';
import '../../models/user.dart';
import '../../providers/auth/auth_provider.dart';
import '../../providers/dashboard/dashboard_providers.dart';
import '../../widgets/calendar/calendar_event_tile.dart';
import '../../widgets/calendar/calendar_helpers.dart';
import '../../widgets/calendar/calendar_legend.dart';
import '../../widgets/calendar/calendar_skeleton.dart';
import '../../widgets/calendar/month_grid.dart';
import '../../widgets/calendar/week_strip.dart';
import '../../widgets/common/empty_state.dart';
import '../../widgets/common/error_view.dart';

enum CalendarView { month, week }

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  CalendarView _view = CalendarView.month;
  late DateTime _anchor;
  late DateTime _selected;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _anchor = DateTime(today.year, today.month, today.day);
    _selected = DateTime(today.year, today.month, today.day);
  }

  DateTime get _monthAnchor => DateTime(_anchor.year, _anchor.month, 1);

  void _select(DateTime day) {
    setState(() {
      _selected = day;
      _anchor = day;
    });
  }

  void _previous() {
    setState(() {
      if (_view == CalendarView.month) {
        _anchor = DateTime(_anchor.year, _anchor.month - 1, 1);
      } else {
        _anchor = _anchor.subtract(const Duration(days: 7));
      }
    });
  }

  void _next() {
    setState(() {
      if (_view == CalendarView.month) {
        _anchor = DateTime(_anchor.year, _anchor.month + 1, 1);
      } else {
        _anchor = _anchor.add(const Duration(days: 7));
      }
    });
  }

  void _goToday() {
    final today = DateTime.now();
    setState(() {
      _anchor = DateTime(today.year, today.month, today.day);
      _selected = DateTime(today.year, today.month, today.day);
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value?.session?.user;
    final eventsAsync = ref.watch(calendarEventsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendrier'),
        actions: [
          TextButton.icon(
            onPressed: _goToday,
            icon: const Icon(Icons.today_outlined, size: 18),
            label: const Text("Aujourd'hui"),
          ),
        ],
      ),
      body: _buildBody(context, user, eventsAsync),
    );
  }

  Widget _buildBody(
    BuildContext context,
    User? user,
    AsyncValue<List<CalendarEvent>> eventsAsync,
  ) {
    if (user?.role != 'STAGIAIRE') {
      return const EmptyState(
        icon: Icons.calendar_month_outlined,
        title: 'Calendrier indisponible',
        message: 'Ce calendrier est réservé aux stagiaires.',
      );
    }

    if (eventsAsync.isLoading && !eventsAsync.hasValue) {
      return const CalendarSkeleton();
    }

    if (eventsAsync.hasError && !eventsAsync.hasValue) {
      return ErrorView(
        message: eventsAsync.error.toString(),
        onRetry: () => ref.refresh(calendarEventsProvider.future),
      );
    }

    final events = eventsAsync.value ?? const <CalendarEvent>[];
    final byDay = groupEventsByDay(events);
    final dayEvents = eventsOnDay(byDay, _selected);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(calendarEventsProvider.future),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: SegmentedButton<CalendarView>(
              segments: const [
                ButtonSegment(
                  value: CalendarView.month,
                  icon: Icon(Icons.calendar_view_month_outlined),
                  label: Text('Mois'),
                ),
                ButtonSegment(
                  value: CalendarView.week,
                  icon: Icon(Icons.view_week_outlined),
                  label: Text('Semaine'),
                ),
              ],
              selected: {_view},
              onSelectionChanged: (selection) {
                setState(() => _view = selection.first);
              },
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              IconButton(
                tooltip: 'Précédent',
                onPressed: _previous,
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Text(
                  _view == CalendarView.month
                      ? '${monthNamesFr[_monthAnchor.month - 1]} ${_monthAnchor.year}'
                      : 'Semaine du ${formatDateFr(startOfWeek(_anchor))} '
                          'au ${formatDateFr(startOfWeek(_anchor).add(const Duration(days: 6)))}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              IconButton(
                tooltip: 'Suivant',
                onPressed: _next,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_view == CalendarView.month)
            MonthGrid(
              month: _monthAnchor,
              selected: _selected,
              eventsByDay: byDay,
              onSelect: _select,
            )
          else
            WeekStrip(
              startOfWeek: startOfWeek(_anchor),
              selected: _selected,
              eventsByDay: byDay,
              onSelect: _select,
            ),
          const SizedBox(height: 16),
          const CalendarLegend(),
          const SizedBox(height: 24),
          Row(
            children: [
              const Icon(Icons.event_outlined, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${weekdayNamesFr[_selected.weekday - 1]} ${formatDateFr(_selected)}',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              if (dayEvents.isNotEmpty)
                Text(
                  '${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.textSecondary),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (dayEvents.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.event_busy_outlined,
                      size: 20, color: AppColors.textSecondary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Aucun événement ce jour.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            )
          else
            for (final event in dayEvents)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CalendarEventTile(event: event),
              ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
