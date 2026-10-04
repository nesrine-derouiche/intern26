import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart' hide Evaluation;
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/dashboard/domain/dashboard_repository.dart';
import 'package:steg_app/features/journal/domain/journal_repository.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/evaluation.dart';
import 'package:steg_app/models/journal_entry.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/supervisor_info.dart';
import 'package:steg_app/models/tache.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/dashboard/dashboard_providers.dart';
import 'package:steg_app/providers/journal/journal_providers.dart';
import 'package:steg_app/screens/journal/journal_screen.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Trabelsi',
  prenom: 'Fatma',
  email: 'fatma@steg.tn',
  role: 'STAGIAIRE',
);

const encadrant = User(
  id: 'e-1',
  nom: 'Ben Salah',
  prenom: 'Ahmed',
  email: 'ahmed@steg.tn',
  role: 'ENCADRANT',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.session});

  AuthSession? session;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

class FakeDashboardRepository implements DashboardRepository {
  FakeDashboardRepository({required this.stats});

  DashboardStats stats;

  @override
  Future<DashboardStats> getDashboardStats() async => stats;

  @override
  Future<List<Tache>> listTaches() async => const [];

  @override
  Future<List<Reunion>> listReunions() async => const [];

  @override
  Future<List<DocumentItem>> listDocuments({required String stageId}) async =>
      const [];

  @override
  Future<DocumentItem> uploadDocument({
    required String stageId,
    required String type,
    required String filePath,
    String? fileName,
  }) async {
    final document = DocumentItem.fromJson({
      'id': 'uploaded-1',
      'stage_id': stageId,
      'type': type,
      'nom': fileName ?? 'fichier.pdf',
    });
    return document;
  }

  @override
  Future<Uint8List> downloadDocumentBytes({
    required String id,
    bool preview = false,
  }) async =>
      Uint8List(0);

  @override
  Future<Uint8List> downloadStagePdf({
    required String stageId,
    required String kind,
  }) async =>
      Uint8List(0);

  @override
  Future<void> deleteDocument(String id) async {}

  @override
  Future<List<Evaluation>> listEvaluations() async => const [];

  @override
  Future<List<AppNotification>> listNotifications() async => const [];

  @override
  Future<int> unreadNotificationsCount() async => 0;

  @override
  Future<void> markNotificationAsRead(String id) async {}

  @override
  Future<void> markAllNotificationsAsRead() async {}

  @override
  Future<void> deleteNotification(String id) async {}

  @override
  Future<List<SupervisorInfo>> listSupervisors() async => const [];
}

class FakeJournalRepository implements JournalRepository {
  FakeJournalRepository({List<JournalEntry>? journals})
      : journals = journals ?? [];

  List<JournalEntry> journals;

  @override
  Future<PaginatedResult<JournalEntry>> listJournals({
    required int page,
    required int limit,
  }) async {
    return PaginatedResult(
      data: List.of(journals),
      total: journals.length,
      page: 1,
      pages: journals.isEmpty ? 0 : 1,
    );
  }

  @override
  Future<JournalEntry> createJournal(JournalDraft draft) async {
    final entry = JournalEntry.fromJson({
      'id': 'created-1',
      'stage_id': draft.stageId,
      'semaine': '2026-01-12',
      'travaux': draft.travaux,
      'heures': draft.heures,
      'statut': 'BROUILLON',
    });
    journals.add(entry);
    return entry;
  }

  @override
  Future<JournalEntry> updateJournal({
    required String id,
    required JournalDraft draft,
  }) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'stage_id': journals[index].stageId,
      'semaine': '2026-01-12',
      'travaux': draft.travaux,
      'heures': draft.heures,
      'statut': 'BROUILLON',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> submitJournal(String id) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'SOUMIS',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> validateJournal(String id, {String commentaire = ''}) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'VALIDE',
      'commentaire_encadrant': commentaire,
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<JournalEntry> rejectJournal(String id, {String commentaire = ''}) async {
    final index = journals.indexWhere((j) => j.id == id);
    final updated = JournalEntry.fromJson({
      'id': id,
      'semaine': '2026-01-12',
      'travaux': journals[index].travaux,
      'statut': 'REJETE',
    });
    journals[index] = updated;
    return updated;
  }

  @override
  Future<void> deleteJournal(String id) async {
    journals.removeWhere((j) => j.id == id);
  }
}

JournalEntry journal(String id, String semaine, String statut) {
  return JournalEntry.fromJson({
    'id': id,
    'stage_id': 'stage-1',
    'semaine': semaine,
    'travaux': 'Travaux de la semaine $id',
    'heures': '36',
    'statut': statut,
    'stagiaire_nom': 'Trabelsi',
    'stagiaire_prenom': 'Fatma',
  });
}

ProviderScope buildApp({
  required User user,
  required FakeJournalRepository journals,
  DashboardStats? stats,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(
          session: AuthSession(accessToken: 'token', user: user),
        ),
      ),
      journalRepositoryProvider.overrideWithValue(journals),
      dashboardRepositoryProvider.overrideWithValue(
        FakeDashboardRepository(
          stats: stats ??
              DashboardStats.fromJson({
                'recentStages': [
                  {
                    'id': 'stage-1',
                    'date_debut': '2026-01-01',
                    'date_fin': '2026-06-30',
                    'statut': 'EN_COURS',
                    'offre_titre': 'Développeur Angular',
                  },
                ],
              }),
        ),
      ),
    ],
    child: const MaterialApp(home: JournalScreen()),
  );
}

void main() {
  testWidgets('renders the journal list for a stagiaire', (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        user: stagiaire,
        journals: FakeJournalRepository(journals: [
          journal('j1', '2026-01-12', 'VALIDE'),
          journal('j2', '2026-01-19', 'SOUMIS'),
        ]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(JournalScreen), findsOneWidget);
    expect(find.text('Semaine du 12/01/2026 au 18/01/2026'), findsOneWidget);
    expect(find.text('Semaine du 19/01/2026 au 25/01/2026'), findsOneWidget);
    expect(find.text('Validé'), findsOneWidget);
    expect(find.text('Soumis'), findsOneWidget);
    expect(find.text('Travaux de la semaine j1'), findsOneWidget);
    expect(find.byIcon(Icons.add), findsWidgets);
  });

  testWidgets('shows validation actions to an encadrant on submitted journals',
      (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        user: encadrant,
        journals: FakeJournalRepository(
          journals: [journal('j1', '2026-01-12', 'SOUMIS')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Valider'), findsOneWidget);
    expect(find.text('Rejeter'), findsOneWidget);
    expect(find.text('Fatma Trabelsi'), findsOneWidget);
  });

  testWidgets('hides editing actions from a stagiaire once submitted',
      (tester) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        user: stagiaire,
        journals: FakeJournalRepository(
          journals: [journal('j1', '2026-01-12', 'SOUMIS')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Modifier'), findsNothing);
    expect(find.text('Soumettre'), findsNothing);
  });

  testWidgets('blocks non-privileged roles on the journal screen', (tester) async {
    await tester.pumpWidget(
      buildApp(user: admin, journals: FakeJournalRepository()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Journal indisponible'), findsOneWidget);
  });

  testWidgets('shows an empty state when the stagiaire has no journal',
      (tester) async {
    await tester.pumpWidget(
      buildApp(user: stagiaire, journals: FakeJournalRepository()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Aucun journal'), findsOneWidget);
  });

  testWidgets('creates a journal from the form and shows it in the list',
      (tester) async {
    tester.view.physicalSize = const Size(800, 2200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = FakeJournalRepository();
    await tester.pumpWidget(
      buildApp(user: stagiaire, journals: repository),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();

    expect(find.text('Nouveau journal'), findsOneWidget);

    final travauxField = find.byType(TextFormField).first;
    await tester.enterText(travauxField, 'Rédaction du premier journal');
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(repository.journals, hasLength(1));
    expect(find.text('Rédaction du premier journal'), findsOneWidget);
    expect(find.text('Brouillon'), findsOneWidget);
  });
}
