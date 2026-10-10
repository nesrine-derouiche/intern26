import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/certification_eligibility.dart';
import '../../models/calendar_event.dart';
import 'calendar_helpers.dart';

class WeekStrip extends StatelessWidget {
  const WeekStrip({
    super.key,
    required this.startOfWeek,
    required this.selected,
    required this.eventsByDay,
    required this.onSelect,
    this.finalWeekEnd,
  });

  final DateTime startOfWeek;
  final DateTime selected;
  final Map<DateTime, List<CalendarEvent>> eventsByDay;
  final ValueChanged<DateTime> onSelect;

  /// Inclusive end date of the internship final week (null = no highlight).
  final DateTime? finalWeekEnd;

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();

    return Row(
      children: [
        for (var i = 0; i < 7; i++)
          Expanded(
            child: _DayCell(
              date: DateTime(
                startOfWeek.year,
                startOfWeek.month,
                startOfWeek.day + i,
              ),
              isSelected: _sameDay(
                DateTime(
                  startOfWeek.year,
                  startOfWeek.month,
                  startOfWeek.day + i,
                ),
                selected,
              ),
              isToday: _sameDay(
                DateTime(
                  startOfWeek.year,
                  startOfWeek.month,
                  startOfWeek.day + i,
                ),
                today,
              ),
              isFinalWeek: isFinalWeekDay(
                DateTime(
                  startOfWeek.year,
                  startOfWeek.month,
                  startOfWeek.day + i,
                ),
                finalWeekEnd,
              ),
              events:
                  eventsByDay[DateTime(
                    startOfWeek.year,
                    startOfWeek.month,
                    startOfWeek.day + i,
                  )] ??
                  const <CalendarEvent>[],
              onTap: () => onSelect(
                DateTime(
                  startOfWeek.year,
                  startOfWeek.month,
                  startOfWeek.day + i,
                ),
              ),
            ),
          ),
      ],
    );
  }

  static bool _sameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.isSelected,
    required this.isToday,
    required this.isFinalWeek,
    required this.events,
    required this.onTap,
  });

  final DateTime date;
  final bool isSelected;
  final bool isToday;
  final bool isFinalWeek;
  final List<CalendarEvent> events;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dayColor = isSelected
        ? Colors.white
        : (isToday ? AppColors.primary : AppColors.textPrimary);

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary
              : (isFinalWeek
                    ? AppColors.danger.withValues(alpha: 0.10)
                    : Colors.transparent),
          borderRadius: BorderRadius.circular(12),
          border: isToday && !isSelected
              ? Border.all(color: AppColors.primary, width: 1.5)
              : null,
        ),
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(
          children: [
            Text(
              weekdayLabels[date.weekday - 1],
              style: theme.textTheme.bodySmall?.copyWith(
                color: isSelected ? Colors.white70 : AppColors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${date.day}',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: dayColor,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final event in events.take(3))
                  Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 1),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.white : event.type.color,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
