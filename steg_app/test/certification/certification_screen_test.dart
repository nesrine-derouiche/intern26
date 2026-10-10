import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:steg_app/models/certification.dart';
import 'package:steg_app/providers/certification/certification_provider.dart';
import 'package:steg_app/screens/certification/certification_screen.dart';
import 'package:steg_app/services/certification_service.dart';

CertificationState stateWith({
  String statut = 'NOT_SUBMITTED',
  bool withDocs = false,
  String? reason,
}) {
  CertificationDocument? doc(String kind, String id, String nom) => withDocs
      ? CertificationDocument(
          id: id,
          kind: kind,
          version: 1,
          nom: nom,
          taille: 1024,
        )
      : null;
  return CertificationState(
    statut: statut,
    reason: reason,
    journal: doc('JOURNAL', 'd1', 'journal.pdf'),
    rapport: doc('RAPPORT', 'd2', 'rapport.pdf'),
  );
}

class FakeCertificationService extends CertificationService {
  FakeCertificationService() : super(Dio());

  CertificationState state = stateWith();
  int submitCalls = 0;
  bool failSubmit = false;

  @override
  Future<CertificationState> getState({required String stageId}) async => state;

  @override
  Future<CertificationState> submit({required String stageId}) async {
    submitCalls++;
    if (failSubmit) {
      throw Exception('Dossier incomplet.');
    }
    state = CertificationState(
      statut: 'SUBMITTED',
      journal: state.journal,
      rapport: state.rapport,
    );
    return state;
  }
}

Widget buildTestApp(FakeCertificationService service) {
  return ProviderScope(
    overrides: [certificationServiceProvider.overrideWithValue(service)],
    child: const MaterialApp(home: CertificationScreen(stageId: 'stage-1')),
  );
}

void main() {
  testWidgets('renders both upload controls with filenames and sizes', (
    tester,
  ) async {
    final service = FakeCertificationService()
      ..state = stateWith(withDocs: true);
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    expect(find.text('Journal de stage'), findsOneWidget);
    expect(find.text('Rapport de stage STEG'), findsOneWidget);
    expect(find.text('journal.pdf'), findsOneWidget);
    expect(find.text('rapport.pdf'), findsOneWidget);
    expect(find.text('1.0 Ko'), findsNWidgets(2));
  });

  testWidgets('confirm stays disabled until both documents are present', (
    tester,
  ) async {
    final service = FakeCertificationService()
      ..state = stateWith(withDocs: false);
    service.state = CertificationState(
      statut: 'NOT_SUBMITTED',
      journal: const CertificationDocument(
        id: 'd1',
        kind: 'JOURNAL',
        version: 1,
        nom: 'journal.pdf',
        taille: 512,
      ),
    );
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Transmettre pour validation'));
    await tester.pumpAndSettle();

    expect(service.submitCalls, 0);
    expect(find.text('Dossier transmis'), findsNothing);
  });

  testWidgets('shows a success dialog after backend confirmation', (
    tester,
  ) async {
    final service = FakeCertificationService()
      ..state = stateWith(withDocs: true);
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Transmettre pour validation'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(service.submitCalls, 1);
    expect(find.text('Dossier transmis'), findsOneWidget);
    expect(
      find.textContaining(
        'Vos documents ont été transmis à votre encadrant pour validation.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Compris'));
    await tester.pumpAndSettle();
    expect(find.text('Dossier transmis'), findsNothing);
  });

  testWidgets('keeps files and shows an error when submission fails', (
    tester,
  ) async {
    final service = FakeCertificationService()
      ..state = stateWith(withDocs: true)
      ..failSubmit = true;
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Transmettre pour validation'));
    await tester.pumpAndSettle();

    expect(find.text('Dossier transmis'), findsNothing);
    expect(find.textContaining('Soumission échouée'), findsOneWidget);
    expect(find.text('journal.pdf'), findsOneWidget);
    expect(find.text('rapport.pdf'), findsOneWidget);
  });

  testWidgets('displays refusal reasons and history', (tester) async {
    final service = FakeCertificationService()
      ..state = stateWith(
        statut: 'DENIED',
        withDocs: true,
        reason: 'Rapport illisible.',
      );
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    expect(find.text('Refusé'), findsOneWidget);
    expect(find.textContaining('Rapport illisible.'), findsOneWidget);
  });

  testWidgets('shows an empty state when nothing is deposited', (tester) async {
    final service = FakeCertificationService();
    await tester.pumpWidget(buildTestApp(service));
    await tester.pumpAndSettle();

    expect(find.text('Aucun fichier déposé.'), findsNWidgets(2));
  });
}
