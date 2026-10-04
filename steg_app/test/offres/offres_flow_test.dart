import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:steg_app/app.dart';
import 'package:steg_app/core/routing/route_paths.dart';
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
import 'package:steg_app/screens/offres/offre_details_screen.dart';
import '../helpers/fake_stagiaire_overview_repository.dart';
import 'package:steg_app/screens/offres/offres_list_screen.dart';

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

Offre buildOffre({
  required String id,
  required String titre,
  String departement = 'Transmission',
  String statut = 'OUVERTE',
  int places = 2,
}) {
  return Offre(
    id: id,
    titre: titre,
    description: 'Description de $titre.',
    duree: 6,
    competencesDemandees: 'Réseaux, Linux',
    nombrePlaces: places,
    statut: statut,
    departementNom: departement,
    nbCandidatures: 0,
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
  FakeOffreRepository({required this.offres, this.candidatures = const []});

  List<Offre> offres;
  List<Candidature> candidatures;
  int applyCalls = 0;

  @override
  Future<PaginatedResult<Offre>> listOffres({
    required int page,
    required int limit,
  }) async {
    final start = (page - 1) * limit;
    final data = offres.skip(start).take(limit).toList();
    return PaginatedResult(
      data: data,
      total: offres.length,
      page: page,
      pages: offres.isEmpty ? 0 : (offres.length / limit).ceil(),
    );
  }

  @override
  Future<List<Candidature>> listMyCandidatures() async => List.of(candidatures);

  @override
  Future<Candidature> applyToOffre({
    required String stagiaireId,
    required String offreId,
  }) async {
    applyCalls++;
    final candidature = Candidature(
      id: 'c-${candidatures.length + 1}',
      stagiaireId: stagiaireId,
      offreId: offreId,
      statut: 'EN_ATTENTE',
      stagiaireNom: 'Ben Ahmed',
      stagiairePrenom: 'Sami',
      offreTitre: 'Titre',
      departementNom: 'Transmission',
    );
    candidatures = [...candidatures, candidature];
    return candidature;
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

Future<void> goToOffres(WidgetTester tester) async {
  final context = tester.element(find.byType(Scaffold).first);
  GoRouter.of(context).go(RoutePaths.offres);
  await tester.pumpAndSettle();
}

Future<void> openOffer(WidgetTester tester, String title) async {
  await tester.tap(find.text(title));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('navigates from home to the offers list and renders offers', (tester) async {
    final offres = FakeOffreRepository(
      offres: [
        buildOffre(id: 'o-1', titre: 'Stage Réseaux'),
        buildOffre(id: 'o-2', titre: 'Stage Distribution'),
      ],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();

    await goToOffres(tester);

    expect(find.byType(OffresListScreen), findsOneWidget);
    expect(find.text('Stage Réseaux'), findsOneWidget);
    expect(find.text('Stage Distribution'), findsOneWidget);
    expect(find.text('Transmission'), findsWidgets);
  });

  testWidgets('search narrows the offers list', (tester) async {
    final offres = FakeOffreRepository(
      offres: [
        buildOffre(id: 'o-1', titre: 'Stage Réseaux'),
        buildOffre(id: 'o-2', titre: 'Stage Distribution'),
        buildOffre(id: 'o-3', titre: 'Stage Réseaux Fibre'),
      ],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();
    await goToOffres(tester);

    await tester.enterText(find.byType(TextField), 'distribution');
    await tester.pumpAndSettle();

    expect(find.text('Stage Distribution'), findsOneWidget);
    expect(find.text('Stage Réseaux'), findsNothing);
    expect(find.text('Stage Réseaux Fibre'), findsNothing);
  });

  testWidgets('statut filter in the bottom sheet narrows the list', (tester) async {
    final offres = FakeOffreRepository(
      offres: [
        buildOffre(id: 'o-1', titre: 'Stage Réseaux', statut: 'OUVERTE'),
        buildOffre(id: 'o-2', titre: 'Stage Distribution', statut: 'OUVERTE'),
        buildOffre(
          id: 'o-3',
          titre: 'Stage Central',
          departement: 'Distribution',
          statut: 'POURVUE',
        ),
      ],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();
    await goToOffres(tester);

    await tester.tap(find.byIcon(Icons.tune));
    await tester.pumpAndSettle();

    final pourvueChip = find.descendant(
      of: find.byType(ChoiceChip),
      matching: find.text('Pourvue'),
    );
    await tester.tap(pourvueChip);
    await tester.tap(find.text('Voir les résultats'));
    await tester.pumpAndSettle();

    expect(find.text('Stage Central'), findsOneWidget);
    expect(find.text('Stage Réseaux'), findsNothing);
    expect(find.text('Stage Distribution'), findsNothing);
  });

  testWidgets('stagiaire can apply to an open offer and sees confirmation', (tester) async {
    final offres = FakeOffreRepository(
      offres: [buildOffre(id: 'o-1', titre: 'Stage Réseaux')],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();
    await goToOffres(tester);
    await openOffer(tester, 'Stage Réseaux');

    expect(find.byType(OffreDetailsScreen), findsOneWidget);
    expect(find.text('Postuler à cette offre'), findsOneWidget);

    await tester.tap(find.text('Postuler à cette offre'));
    await tester.pumpAndSettle();
    expect(find.text('Confirmer la candidature'), findsOneWidget);

    await tester.tap(find.text('Confirmer'));
    await tester.pumpAndSettle();

    expect(offres.applyCalls, 1);
    expect(find.text('Candidature envoyée avec succès.'), findsOneWidget);
    expect(find.text('Déjà postulé'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
  });

  testWidgets('already applied offer shows a disabled state', (tester) async {
    final offres = FakeOffreRepository(
      offres: [buildOffre(id: 'o-1', titre: 'Stage Réseaux')],
      candidatures: [
        const Candidature(
          id: 'c-1',
          stagiaireId: 's-1',
          offreId: 'o-1',
          statut: 'EN_ATTENTE',
          stagiaireNom: 'Ben Ahmed',
          stagiairePrenom: 'Sami',
          offreTitre: 'Stage Réseaux',
          departementNom: 'Transmission',
        ),
      ],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: stagiaire),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();
    await goToOffres(tester);
    await openOffer(tester, 'Stage Réseaux');

    expect(find.text('Déjà postulé'), findsOneWidget);
    expect(find.text('Postuler à cette offre'), findsNothing);

    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Déjà postulé'),
    );
    expect(button.onPressed, isNull);
  });

  testWidgets('admin sees offer details without an apply button', (tester) async {
    final offres = FakeOffreRepository(
      offres: [buildOffre(id: 'o-1', titre: 'Stage Réseaux')],
    );

    await tester.pumpWidget(
      buildApp(
        auth: FakeAuthRepository(
          session: const AuthSession(accessToken: 'token', user: admin),
        ),
        offres: offres,
      ),
    );
    await tester.pumpAndSettle();
    await goToOffres(tester);
    await openOffer(tester, 'Stage Réseaux');

    expect(find.byType(OffreDetailsScreen), findsOneWidget);
    expect(find.text('Postuler à cette offre'), findsNothing);
    expect(find.text('Déjà postulé'), findsNothing);
  });
}
