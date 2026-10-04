import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/application_status.dart';

void main() {
  group('ApplicationStatut', () {
    test('maps backend status values to enum entries', () {
      expect(ApplicationStatut.fromValue('EN_ATTENTE'), ApplicationStatut.enAttente);
      expect(ApplicationStatut.fromValue('ACCEPTEE'), ApplicationStatut.acceptee);
      expect(ApplicationStatut.fromValue('REFUSEE'), ApplicationStatut.refusee);
      expect(ApplicationStatut.fromValue('STAGIAIRE_CREATED'), ApplicationStatut.stagiaireCree);
    });

    test('returns null for unknown values', () {
      expect(ApplicationStatut.fromValue('INCONNU'), isNull);
      expect(ApplicationStatut.fromValue(null), isNull);
    });

    test('exposes French labels', () {
      expect(ApplicationStatut.enAttente.label, 'En attente');
      expect(ApplicationStatut.acceptee.label, 'Acceptée');
      expect(ApplicationStatut.refusee.label, 'Refusée');
      expect(ApplicationStatut.stagiaireCree.label, 'Stagiaire créé');
    });
  });
}
