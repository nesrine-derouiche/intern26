import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/models/personal_tache.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/personal_tache/personal_tache_providers.dart';
import 'package:steg_app/screens/dashboard/my_tasks_screen.dart';

class FakeMyTachesNotifier extends MyTachesNotifier {
  @override
  Future<List<Tache>> build() async => const [];
}

class FakePersonalTachesNotifier extends PersonalTachesNotifier {
  @override
  Future<List<PersonalTache>> build() async => const [
        PersonalTache(
          id: 'p1',
          stagiaireId: 's-1',
          titre: 'Relire le rapport',
          statut: 'A_FAIRE',
          position: 0,
          createdAt: '',
          updatedAt: '',
        ),
      ];
}

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      myTachesProvider.overrideWith(FakeMyTachesNotifier.new),
      tachesSectionsProvider.overrideWithValue(const []),
      personalTachesProvider.overrideWith(FakePersonalTachesNotifier.new),
    ],
    child: const MaterialApp(
      home: MyTasksScreen(),
    ),
  );
}

void main() {
  testWidgets(
      'modifier opens the edit sheet without popping the tasks page',
      (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pumpAndSettle();

    expect(find.text('Relire le rapport'), findsOneWidget);

    await tester.longPress(find.text('Relire le rapport'));
    await tester.pumpAndSettle();

    expect(find.text('Modifier'), findsOneWidget);

    await tester.tap(find.text('Modifier'));
    await tester.pumpAndSettle();

    expect(find.text('Modifier la tâche'), findsOneWidget);
    expect(find.text('Relire le rapport'), findsNWidgets(2));
  });
}
