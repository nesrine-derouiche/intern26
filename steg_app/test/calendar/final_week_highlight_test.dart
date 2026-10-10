import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/core/theme/app_colors.dart';
import 'package:steg_app/models/calendar_event.dart';
import 'package:steg_app/widgets/calendar/month_grid.dart';
import 'package:steg_app/widgets/calendar/week_strip.dart';

Color get markerColor => AppColors.danger.withValues(alpha: 0.10);

Finder markedCells() {
  return find.byWidgetPredicate(
    (widget) =>
        widget is Container &&
        widget.decoration is BoxDecoration &&
        (widget.decoration! as BoxDecoration).color == markerColor,
  );
}

Widget wrapInScroll(Widget child) {
  return MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(child: child),
    ),
  );
}

void main() {
  testWidgets('MonthGrid highlights exactly the final seven days',
      (tester) async {
    await tester.pumpWidget(
      wrapInScroll(
        MonthGrid(
          month: DateTime(2026, 10, 1),
          selected: DateTime(2026, 10, 20),
          eventsByDay: const {},
          onSelect: (_) {},
          finalWeekEnd: DateTime(2026, 10, 8),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(markedCells(), findsNWidgets(7));
    expect(tester.takeException(), isNull);
  });

  testWidgets('MonthGrid highlights nothing without an end date',
      (tester) async {
    await tester.pumpWidget(
      wrapInScroll(
        MonthGrid(
          month: DateTime(2026, 10, 1),
          selected: DateTime(2026, 10, 20),
          eventsByDay: const {},
          onSelect: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(markedCells(), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('MonthGrid highlights nothing for unrelated months',
      (tester) async {
    await tester.pumpWidget(
      wrapInScroll(
        MonthGrid(
          month: DateTime(2026, 11, 1),
          selected: DateTime(2026, 11, 20),
          eventsByDay: const {},
          onSelect: (_) {},
          finalWeekEnd: DateTime(2026, 10, 8),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(markedCells(), findsNothing);
  });

  testWidgets('MonthGrid preserves events and selection with highlight',
      (tester) async {
    const event = CalendarEvent(
      id: 'e1',
      type: CalendarEventType.reunion,
      title: 'Point avancement',
      date: null,
    );
    await tester.pumpWidget(
      wrapInScroll(
        MonthGrid(
          month: DateTime(2026, 10, 1),
          selected: DateTime(2026, 10, 5),
          eventsByDay: {
            DateTime(2026, 10, 5): [event],
          },
          onSelect: (_) {},
          finalWeekEnd: DateTime(2026, 10, 8),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Point avancement'), findsNothing);
    expect(find.text('5'), findsOneWidget);
    expect(markedCells(), findsNWidgets(6));
  });

  testWidgets('WeekStrip highlights final-week days only', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WeekStrip(
            startOfWeek: DateTime(2026, 10, 5),
            selected: DateTime(2026, 10, 20),
            eventsByDay: const {},
            onSelect: (_) {},
            finalWeekEnd: DateTime(2026, 10, 8),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(markedCells(), findsNWidgets(4));
    expect(tester.takeException(), isNull);
  });
}
