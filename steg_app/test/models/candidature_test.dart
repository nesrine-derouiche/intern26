import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/candidature.dart';

void main() {
  group('Candidature', () {
    test('fromJson maps backend candidature payload', () {
      final candidature = Candidature.fromJson({
        'id': 'c-1',
        'stagiaire_id': 's-1',
        'offre_id': 'o-1',
        'date_candidature': '2026-07-01T10:00:00.000Z',
        'statut': 'EN_ATTENTE',
        'stagiaire_nom': 'Ben Ahmed',
        'stagiaire_prenom': 'Sami',
        'offre_titre': 'Stage Réseaux',
        'departement_nom': 'Transmission',
      });

      expect(candidature.id, 'c-1');
      expect(candidature.stagiaireId, 's-1');
      expect(candidature.offreId, 'o-1');
      expect(candidature.statut, 'EN_ATTENTE');
      expect(candidature.offreTitre, 'Stage Réseaux');
      expect(candidature.stagiaireFullName, 'Sami Ben Ahmed');
    });

    test('fromJson tolerates missing fields', () {
      final candidature = Candidature.fromJson({});
      expect(candidature.id, '');
      expect(candidature.stagiaireId, '');
      expect(candidature.offreId, '');
      expect(candidature.statut, '');
      expect(candidature.dateCandidature, isNull);
    });
  });
}
