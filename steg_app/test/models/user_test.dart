import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/user.dart';

void main() {
  group('User', () {
    test('fromJson maps backend user payload', () {
      final user = User.fromJson({
        'id': 'u-123',
        'nom': 'Ben Salah',
        'prenom': 'Ahmed',
        'email': 'ahmed@steg.tn',
        'role': 'ADMIN',
      });

      expect(user.id, 'u-123');
      expect(user.nom, 'Ben Salah');
      expect(user.prenom, 'Ahmed');
      expect(user.email, 'ahmed@steg.tn');
      expect(user.role, 'ADMIN');
    });

    test('fromJson tolerates missing fields', () {
      final user = User.fromJson({});
      expect(user.id, '');
      expect(user.email, '');
      expect(user.role, '');
    });

    test('fullName combines prenom and nom', () {
      const user = User(
        id: '1',
        nom: 'Doe',
        prenom: 'John',
        email: 'john@steg.tn',
        role: 'RH',
      );
      expect(user.fullName, 'John Doe');
    });

    test('toJson round-trips values', () {
      const user = User(
        id: '1',
        nom: 'Nom',
        prenom: 'Prenom',
        email: 'a@b.c',
        role: 'STAGIAIRE',
      );
      expect(user.toJson(), {
        'id': '1',
        'nom': 'Nom',
        'prenom': 'Prenom',
        'email': 'a@b.c',
        'role': 'STAGIAIRE',
      });
    });
  });
}
