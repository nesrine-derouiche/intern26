import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/offre.dart';

void main() {
  group('Offre', () {
    test('fromJson maps backend offer payload', () {
      final offre = Offre.fromJson({
        'id': 'offre-1',
        'departement_id': 'dept-1',
        'titre': 'Stage Réseaux',
        'description': 'Stage au sein du département.',
        'duree': 6,
        'competences_demandees': 'Réseaux, Linux\nSécurité',
        'nombre_places': 3,
        'date_limite': '2026-08-31',
        'statut': 'OUVERTE',
        'departement_nom': 'Transmission',
        'nb_candidatures': 4,
      });

      expect(offre.id, 'offre-1');
      expect(offre.departementId, 'dept-1');
      expect(offre.titre, 'Stage Réseaux');
      expect(offre.duree, 6);
      expect(offre.nombrePlaces, 3);
      expect(offre.dateLimite?.year, 2026);
      expect(offre.statut, 'OUVERTE');
      expect(offre.departementNom, 'Transmission');
      expect(offre.nbCandidatures, 4);
      expect(offre.estOuverte, isTrue);
    });

    test('fromJson tolerates missing fields', () {
      final offre = Offre.fromJson({});
      expect(offre.id, '');
      expect(offre.titre, '');
      expect(offre.duree, 0);
      expect(offre.nombrePlaces, 0);
      expect(offre.nbCandidatures, 0);
      expect(offre.dateLimite, isNull);
      expect(offre.estOuverte, isFalse);
    });

    test('estOuverte is false for non-open statuses', () {
      expect(const Offre(
        id: '1',
        titre: '',
        description: '',
        duree: 1,
        competencesDemandees: '',
        nombrePlaces: 1,
        statut: 'POURVUE',
        departementNom: '',
        nbCandidatures: 0,
      ).estOuverte, isFalse);
    });

    test('competences splits on commas and newlines', () {
      const offre = Offre(
        id: '1',
        titre: '',
        description: '',
        duree: 1,
        competencesDemandees: ' Flutter ,Dart\nFigma ',
        nombrePlaces: 1,
        statut: 'OUVERTE',
        departementNom: '',
        nbCandidatures: 0,
      );
      expect(offre.competences, ['Flutter', 'Dart', 'Figma']);
    });

    test('dureeLabel uses singular for one week', () {
      const one = Offre(
        id: '1',
        titre: '',
        description: '',
        duree: 1,
        competencesDemandees: '',
        nombrePlaces: 1,
        statut: 'OUVERTE',
        departementNom: '',
        nbCandidatures: 0,
      );
      const many = Offre(
        id: '2',
        titre: '',
        description: '',
        duree: 8,
        competencesDemandees: '',
        nombrePlaces: 1,
        statut: 'OUVERTE',
        departementNom: '',
        nbCandidatures: 0,
      );
      expect(one.dureeLabel, '1 semaine');
      expect(many.dureeLabel, '8 semaines');
    });
  });
}
