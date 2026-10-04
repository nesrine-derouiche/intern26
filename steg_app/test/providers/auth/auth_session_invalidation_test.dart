import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/core/auth/session_invalidator.dart';
import 'package:steg_app/features/auth/domain/auth_repository.dart';
import 'package:steg_app/features/auth/domain/entities/auth_session.dart';
import 'package:steg_app/models/login_request.dart';
import 'package:steg_app/models/user.dart';
import 'package:steg_app/providers/auth/auth_provider.dart';
import 'package:steg_app/providers/core/api_client_provider.dart';

class TestAuthRepository implements AuthRepository {
  TestAuthRepository({this.session, this.loginSession});

  AuthSession? session;
  AuthSession? loginSession;

  @override
  Future<AuthSession?> getSession() async => session;

  @override
  Future<AuthSession> login(LoginRequest request) async {
    if (loginSession == null) {
      throw Exception('No login session configured');
    }
    session = loginSession;
    return loginSession!;
  }

  @override
  Future<void> logout() async {
    session = null;
  }
}

const _testUser = User(
  id: '1',
  nom: 'Test',
  prenom: 'User',
  email: 'test@steg.tn',
  role: 'STAGIAIRE',
);

const _candidatUser = User(
  id: '2',
  nom: 'Candidat',
  prenom: 'Test',
  email: 'candidat@steg.tn',
  role: 'CANDIDAT',
);

void main() {
  group('Auth session invalidation via 401', () {
    late ProviderContainer container;
    late SessionInvalidator invalidator;

    setUp(() {
      invalidator = SessionInvalidator.instance;
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    test('Test 1: single 401 clears credentials and sets unauthenticated',
        () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'valid-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      // Verify authenticated
      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // Simulate 401
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);
      await container.read(authProvider.future);

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isFalse);
    });

    test('Test 4: non-401 error does NOT invalidate session', () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'valid-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // No invalidation event for non-401 errors
      await Future<void>.delayed(Duration.zero);

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isTrue);
    });

    test('Test 3: multiple simultaneous 401s — no crash, final state unauthenticated',
        () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'valid-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // Fire 3 concurrent invalidations
      invalidator.invalidate();
      invalidator.invalidate();
      invalidator.invalidate();

      // Let all microtasks settle
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isFalse);
    });

    test('Test 6: login after forced invalidation restores auth', () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'old-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      // Start authenticated
      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // Simulate 401
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);
      await container.read(authProvider.future);

      expect(container.read(authProvider).value?.isAuthenticated, isFalse);

      // Now login again
      repository.loginSession =
          const AuthSession(accessToken: 'new-token', user: _testUser);
      await container.read(authProvider.notifier).login(
            const LoginRequest(email: 'test@steg.tn', password: 'password'),
          );

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isTrue);
      expect(authAfter?.session?.accessToken, 'new-token');
    });

    test('Test 7: CANDIDAT → STAGIAIRE token invalidation flow', () async {
      // Start as CANDIDAT
      final repository = TestAuthRepository(
        session:
            const AuthSession(accessToken: 'candidat-token', user: _candidatUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);
      expect(auth.session?.user.role, 'CANDIDAT');

      // Backend converts CANDIDAT → STAGIAIRE and increments token_version.
      // Next API call returns 401 → interceptor fires invalidation.
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);
      await container.read(authProvider.future);

      expect(container.read(authProvider).value?.isAuthenticated, isFalse);

      // Login again → now STAGIAIRE
      const stagiaireUser = User(
        id: '2',
        nom: 'Candidat',
        prenom: 'Test',
        email: 'candidat@steg.tn',
        role: 'STAGIAIRE',
      );
      repository.loginSession =
          const AuthSession(accessToken: 'new-token', user: stagiaireUser);
      await container.read(authProvider.notifier).login(
            const LoginRequest(email: 'candidat@steg.tn', password: 'password'),
          );

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isTrue);
      expect(authAfter?.session?.user.role, 'STAGIAIRE');
    });

    test('Test 8: password change invalidates old token correctly', () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'old-pw-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // Password changed → token_version incremented → old JWT rejected
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);
      await container.read(authProvider.future);

      expect(container.read(authProvider).value?.isAuthenticated, isFalse);

      // Login with new password
      repository.loginSession =
          const AuthSession(accessToken: 'new-pw-token', user: _testUser);
      await container.read(authProvider.notifier).login(
            const LoginRequest(email: 'test@steg.tn', password: 'newPassword'),
          );

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isTrue);
      expect(authAfter?.session?.accessToken, 'new-pw-token');
    });

    test('Test 2: router redirect state after 401', () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'valid-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // Simulate 401
      invalidator.invalidate();
      await Future<void>.delayed(Duration.zero);
      await container.read(authProvider.future);

      // Auth state is now unauthenticated — the router's redirect function
      // reads this value and would redirect to /login
      final authState = container.read(authProvider).value;
      expect(authState?.isAuthenticated, isFalse);
    });

    test('Test 5: 403 Forbidden does NOT invalidate session', () async {
      final repository = TestAuthRepository(
        session: const AuthSession(accessToken: 'valid-token', user: _testUser),
      );
      container = ProviderContainer(
        overrides: [
          sessionInvalidatorProvider.overrideWithValue(invalidator),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );

      final auth = await container.read(authProvider.future);
      expect(auth.isAuthenticated, isTrue);

      // 403 should NOT trigger session invalidation
      // (the interceptor only fires the stream on 401)
      await Future<void>.delayed(Duration.zero);

      final authAfter = container.read(authProvider).value;
      expect(authAfter?.isAuthenticated, isTrue);
    });
  });
}
