import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/features/offres/domain/offre_repository.dart';
import 'package:steg_app/models/candidature.dart';
import 'package:steg_app/models/human_interview.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/offre.dart';
import 'package:steg_app/models/paginated_result.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/offres/offres_providers.dart';
import 'package:steg_app/providers/stagiaire/stagiaire_overview_provider.dart';
import 'package:steg_app/screens/candidatures/application_details_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import 'package:steg_app/screens/candidatures/my_applications_screen.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
);

const admin = User(
  id: 'a-1',
  nom: 'Admin',
  prenom: 'Super',
  email: 'admin@steg.tn',
  role: 'ADMIN',
);

Candidature buildCandidature({
  required String id,
  required String statut,
  required String offreTitre,
}) {
  return Candidature(
    id: id,
    stagiaireId: 's-1',
    offreId: 'o-$id',
    statut: statut,
    stagiaireNom: 'Ben Ahmed',
    stagiairePrenom: 'Sami',
    offreTitre: offreTitre,
    departementNom: 'Informatique',
  );
}

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

class FakeOffreRepository implements OffreRepository {
  FakeOffreRepository({required this.candidatures});

  List<Candidature> candidatures;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) async {
    return const PaginatedResult(data: [], total: 0, page: 1, pages: 0);
  }

  @override
  Future<List<Candidature>> listMyCandidatures() async => List.of(candidatures);

  @override
  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<HumanInterview?> getHumanInterview(String candidatureId) async => null;
}

ProviderScope buildApp({
  required FakeAuthRepository auth,
  required FakeOffreRepository offres,
}) {
  return ProviderScope(
    overrides: [
      authRepositoryProvider.overrideWithValue(auth),
      offreRepositoryProvider.overrideWithValue(offres),
      stagiaireOverviewRepositoryProvider.overrideWithValue(FakeStagiaireOverviewRepository()),
    ],
    child: const StegApp(),
  );
}

void main() {
  testWidgets('home exposes the applications entry to a stagiaire only', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: FakeOffreRepository(candidatures: const []),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mes candidatures'), findsOneWidget);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        offres: FakeOffreRepository(candidatures: const []),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mes candidatures'), findsNothing);
  });

  testWidgets('renders applications grouped by status', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: FakeOffreRepository(
          candidatures: [
            buildCandidature(
              id: 'c1',
              statut: 'EN_ATTENTE',
              offreTitre: 'Stage Réseaux',
            ),
            buildCandidature(
              id: 'c2',
              statut: 'ACCEPTEE',
              offreTitre: 'Stage Angular',
            ),
            buildCandidature(
              id: 'c3',
              statut: 'REFUSEE',
              offreTitre: 'Stage Finance',
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Mes candidatures'));
    await tester.tap(find.text('Mes candidatures'));
    await tester.pumpAndSettle();

    expect(find.byType(MyApplicationsScreen), findsOneWidget);
    expect(find.text('Stage Réseaux'), findsOneWidget);
    expect(find.text('Stage Angular'), findsOneWidget);
    expect(find.text('Stage Finance'), findsOneWidget);

    expect(find.text('En attente'), findsWidgets);
    expect(find.text('Acceptée'), findsWidgets);
    expect(find.text('Refusée'), findsWidgets);
    expect(find.textContaining('Postulé le'), findsNWidgets(3));
  });

  testWidgets('shows an empty state when there are no candidatures', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: FakeOffreRepository(candidatures: const []),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Mes candidatures'));
    await tester.tap(find.text('Mes candidatures'));
    await tester.pumpAndSettle();

    expect(find.byType(MyApplicationsScreen), findsOneWidget);
    expect(find.text('Aucune candidature'), findsOneWidget);
    expect(
      find.text('Postulez à une offre de stage pour retrouver votre historique ici.'),
      findsOneWidget,
    );
  });

  testWidgets('tapping an application opens its details screen', (tester) async {
    tester.view.physicalSize = const Size(1000, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: FakeOffreRepository(
          candidatures: [
            buildCandidature(
              id: 'c1',
              statut: 'EN_ATTENTE',
              offreTitre: 'Stage Réseaux',
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Mes candidatures'));
    await tester.tap(find.text('Mes candidatures'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Stage Réseaux'));
    await tester.pumpAndSettle();

    expect(find.byType(ApplicationDetailsScreen), findsOneWidget);
    expect(find.text('Détail de la candidature'), findsOneWidget);
  });
}
