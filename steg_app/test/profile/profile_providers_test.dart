import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/internship.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/stagiaire_profile.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/profile/profile_providers.dart';
import 'package:steg_app/services/stagiaire_service.dart';

const stagiaire = User(
  id: 's-1',
  nom: 'Ben Ahmed',
  prenom: 'Sami',
  email: 'sami@steg.tn',
  role: 'STAGIAIRE',
  telephone: '22123456',
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

class FakeStagiaireService extends StagiaireService {
  FakeStagiaireService(this.profile) : super(Dio());

  final StagiaireProfile profile;
  int calls = 0;
  String? requestedId;

  @override
  Future<StagiaireProfile> getProfile(String id) async {
    calls++;
    requestedId = id;
    return profile;
  }
}

StagiaireProfile buildProfile() {
  return StagiaireProfile(
    id: 's-1',
    nom: 'Ben Ahmed',
    prenom: 'Sami',
    email: 'sami@steg.tn',
    telephone: '22123456',
    ecole: 'ENIT',
    specialite: 'Génie logiciel',
    niveau: '3ème année',
    competences: 'Flutter, Dart, REST API',
    stages: [
      Internship.fromJson({
        'id': 'st-1',
        'date_debut': '2026-07-01',
        'date_fin': '2026-12-31',
        'statut': 'EN_COURS',
        'departement_nom': 'Informatique',
        'encadrant_nom': 'Trabelsi',
        'encadrant_prenom': 'Ahmed',
        'offre_titre': 'Stage développement web',
      }),
    ],
  );
}

ProviderContainer containerWith({
  required AuthSession? session,
  required StagiaireProfile profile,
}) {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(
        FakeAuthRepository(session: session),
      ),
      stagiaireServiceProvider.overrideWithValue(
        FakeStagiaireService(profile),
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('profileProvider', () {
    test('loads the stagiaire profile for a stagiaire user', () async {
      final profile = buildProfile();
      final container = containerWith(
        session: const AuthSession(accessToken: 'token', user: stagiaire),
        profile: profile,
      );

      final result = await container.read(profileProvider.future);

      expect(result, isNotNull);
      expect(result!.fullName, 'Sami Ben Ahmed');
      expect(result.ecole, 'ENIT');
      expect(result.skills, ['Flutter', 'Dart', 'REST API']);
      expect(result.activeStage?.departementNom, 'Informatique');
      expect(result.activeStage?.encadrantFullName, 'Ahmed Trabelsi');
    });

    test('requests the profile of the authenticated user id', () async {
      final container = containerWith(
        session: const AuthSession(accessToken: 'token', user: stagiaire),
        profile: buildProfile(),
      );

      await container.read(profileProvider.future);

      final service = container
          .read(stagiaireServiceProvider) as FakeStagiaireService;
      expect(service.requestedId, 's-1');
    });

    test('returns null for non-stagiaire roles without calling the service',
        () async {
      final container = containerWith(
        session: const AuthSession(accessToken: 'token', user: admin),
        profile: buildProfile(),
      );

      final result = await container.read(profileProvider.future);

      expect(result, isNull);
      final service = container
          .read(stagiaireServiceProvider) as FakeStagiaireService;
      expect(service.calls, 0);
    });
  });

  group('settingsProvider', () {
    test('starts with default settings', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final settings = container.read(settingsProvider);
      expect(settings.pushNotifications, isTrue);
      expect(settings.language, 'Français');
    });

    test('toggles push notifications', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(settingsProvider.notifier).togglePushNotifications();
      expect(container.read(settingsProvider).pushNotifications, isFalse);

      container.read(settingsProvider.notifier).togglePushNotifications();
      expect(container.read(settingsProvider).pushNotifications, isTrue);
    });
  });
}
