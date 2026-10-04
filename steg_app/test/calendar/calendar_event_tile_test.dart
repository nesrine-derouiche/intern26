import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/models/calendar_event.dart';
import 'package:steg_app/widgets/calendar/calendar_event_tile.dart';

void main() {
  testWidgets('long location is ellipsized without layout overflow',
      (tester) async {
    const event = CalendarEvent(
      id: 'e1',
      type: CalendarEventType.reunion,
      title: 'Pointage — entrée',
      time: '14:19',
      location: '99abba21-4b98-4983-9e70-77bdea5f0d0d0d0d0d0d-extra-long',
      date: null,
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 360,
            child: CalendarEventTile(event: event),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pointage — entrée'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
