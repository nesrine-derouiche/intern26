import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/login_response.dart';

void main() {
  group('LoginResponse', () {
    test('fromJson parses the backend /auth/login payload', () {
      final response = LoginResponse.fromJson({
        'message': 'Connexion réussie',
        'token': 'eyJhbGciOiJIUzI1NiJ9.xxx',
        'user': {
          'id': 'u-1',
          'nom': 'Admin',
          'prenom': 'Super',
          'email': 'admin@steg.tn',
          'role': 'ADMIN',
        },
      });

      expect(response.message, 'Connexion réussie');
      expect(response.token, 'eyJhbGciOiJIUzI1NiJ9.xxx');
      expect(response.user.id, 'u-1');
      expect(response.user.email, 'admin@steg.tn');
      expect(response.user.role, 'ADMIN');
    });
  });
}
