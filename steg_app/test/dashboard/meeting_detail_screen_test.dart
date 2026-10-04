import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/screens/dashboard/meeting_detail_screen.dart';

Reunion _makeReunion({
  String sujet = 'Point projet',
  String date = '2026-07-22',
  String heure = '10:00',
  String? salle = 'B204',
  String? lienVisio,
}) {
  return Reunion.fromJson({
    'id': 'r1',
    'stage_id': 'stage-1',
    'sujet': sujet,
    'date': date,
    'heure': heure,
    'salle': salle,
    'lien_visio': lienVisio,
    'encadrant_nom': 'Ben Salah',
    'encadrant_prenom': 'Ahmed',
  });
}

void main() {
  group('MeetingDetailScreen', () {
    testWidgets('displays meeting subject and date/time', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(reunion: _makeReunion()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Point projet'), findsOneWidget);
      expect(find.text('22/07/2026'), findsOneWidget);
      expect(find.text('10h00'), findsOneWidget);
    });

    testWidgets('displays location information', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(reunion: _makeReunion()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Salle B204'), findsOneWidget);
      expect(find.text('Lieu'), findsOneWidget);
    });

    testWidgets('displays encadrant name', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(reunion: _makeReunion()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Ahmed Ben Salah'), findsOneWidget);
      expect(find.text('Encadrant'), findsOneWidget);
    });

    testWidgets('shows join video button for upcoming meetings with visio link',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(
            date: '2099-12-01',
            lienVisio: 'https://meet.example.com/abc',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Rejoindre la visio'), findsOneWidget);
      expect(find.byIcon(Icons.videocam), findsOneWidget);
    });

    testWidgets('hides join video button for past meetings', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(
            date: '2020-01-01',
            lienVisio: 'https://meet.example.com/abc',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Rejoindre la visio'), findsNothing);
    });

    testWidgets('hides join video button when no visio link', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(date: '2099-12-01', lienVisio: null),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Rejoindre la visio'), findsNothing);
    });

    testWidgets('shows visio+ salle combined location', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(
            salle: 'B204',
            lienVisio: 'https://meet.example.com/abc',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('B204 (Visio)'), findsOneWidget);
    });

    testWidgets('shows "Salle à confirmer" when no salle and no visio',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(salle: null, lienVisio: null),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Salle à confirmer'), findsOneWidget);
    });

    testWidgets('shows "Passée" badge for past meetings', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(date: '2020-01-01'),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Passée'), findsWidgets);
      expect(find.byIcon(Icons.event_outlined), findsOneWidget);
    });

    testWidgets('shows "À venir" badge for upcoming meetings', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: MeetingDetailScreen(
          reunion: _makeReunion(date: '2099-12-01'),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('À venir'), findsWidgets);
      expect(find.byIcon(Icons.event_outlined), findsOneWidget);
    });
  });
}
