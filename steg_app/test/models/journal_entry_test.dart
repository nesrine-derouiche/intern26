import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/journal_entry.dart';

void main() {
  group('JournalStatut', () {
    test('parses known values and maps unknown to brouillon', () {
      expect(JournalStatut.fromValue('BROUILLON'), JournalStatut.brouillon);
      expect(JournalStatut.fromValue('SOUMIS'), JournalStatut.soumis);
      expect(JournalStatut.fromValue('VALIDE'), JournalStatut.valide);
      expect(JournalStatut.fromValue('REJETE'), JournalStatut.rejete);
      expect(JournalStatut.fromValue('INCONNU'), isNull);
    });

    test('exposes french labels', () {
      expect(JournalStatut.brouillon.label, 'Brouillon');
      expect(JournalStatut.soumis.label, 'Soumis');
      expect(JournalStatut.valide.label, 'Validé');
      expect(JournalStatut.rejete.label, 'Rejeté');
    });
  });

  group('JournalEntry.fromJson', () {
    test('parses a full row from the API', () {
      final entry = JournalEntry.fromJson({
        'id': 'j1',
        'stage_id': 's1',
        'semaine': '2026-01-12',
        'travaux': 'Découverte du projet Angular',
        'difficultes': 'Installation de l\'environnement',
        'solutions': 'Aide de l\'encadrant et documentation',
        'competences': 'Angular, Git',
        'heures': '36',
        'commentaire': 'Bon rythme',
        'statut': 'VALIDE',
        'commentaire_encadrant': 'Très bon démarrage',
        'date_soumission': '2026-01-16T09:00:00.000Z',
        'date_validation': '2026-01-17T10:00:00.000Z',
        'stagiaire_nom': 'Trabelsi',
        'stagiaire_prenom': 'Fatma',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
        'offre_titre': 'Développeur Angular',
      });

      expect(entry.id, 'j1');
      expect(entry.stageId, 's1');
      expect(entry.semaine, DateTime(2026, 1, 12));
      expect(entry.travaux, 'Découverte du projet Angular');
      expect(entry.difficultes, 'Installation de l\'environnement');
      expect(entry.solutions, 'Aide de l\'encadrant et documentation');
      expect(entry.competences, 'Angular, Git');
      expect(entry.heures, 36);
      expect(entry.statut, JournalStatut.valide);
      expect(entry.commentaireEncadrant, 'Très bon démarrage');
      expect(entry.dateSoumission, isNotNull);
      expect(entry.dateValidation, isNotNull);
      expect(entry.stagiaireFullName, 'Fatma Trabelsi');
      expect(entry.encadrantFullName, 'Ahmed Ben Salah');
      expect(entry.offreTitre, 'Développeur Angular');
    });

    test('defaults gracefully for missing fields', () {
      final entry = JournalEntry.fromJson({'id': 'j2'});

      expect(entry.id, 'j2');
      expect(entry.statut, JournalStatut.brouillon);
      expect(entry.travaux, '');
      expect(entry.heures, 0);
      expect(entry.semaine, isNull);
      expect(entry.stagiaireFullName, '');
    });
  });

  group('JournalEntry helpers', () {
    JournalEntry entryWith(String semaine) =>
        JournalEntry.fromJson({'id': 'j1', 'semaine': semaine});

    test('semaineRangeLabel builds the monday-to-sunday range', () {
      expect(
        entryWith('2026-01-12').semaineRangeLabel,
        'Semaine du 12/01/2026 au 18/01/2026',
      );
    });

    test('heuresLabel drops the decimal when whole', () {
      final whole = JournalEntry.fromJson({'id': 'j1', 'heures': '36'});
      final decimal = JournalEntry.fromJson({'id': 'j2', 'heures': '35.5'});
      expect(whole.heuresLabel, '36');
      expect(decimal.heuresLabel, '35.5');
    });

    test('isEditable is true only for brouillon and rejete', () {
      final brouillon = JournalEntry.fromJson({'id': 'j1', 'statut': 'BROUILLON'});
      final rejete = JournalEntry.fromJson({'id': 'j2', 'statut': 'REJETE'});
      final soumis = JournalEntry.fromJson({'id': 'j3', 'statut': 'SOUMIS'});
      final valide = JournalEntry.fromJson({'id': 'j4', 'statut': 'VALIDE'});

      expect(brouillon.isEditable, isTrue);
      expect(rejete.isEditable, isTrue);
      expect(soumis.isEditable, isFalse);
      expect(valide.isEditable, isFalse);
    });
  });

  group('JournalDraft', () {
    test('serializes to the API payload with semaine as YYYY-MM-DD', () {
      final draft = JournalDraft(
        stageId: 's1',
        semaine: DateTime(2026, 1, 12),
        travaux: 'Configurer l\'environnement',
        heures: 36,
      );

      expect(draft.toJson(), {
        'stage_id': 's1',
        'semaine': '2026-01-12',
        'travaux': 'Configurer l\'environnement',
        'difficultes': '',
        'solutions': '',
        'competences': '',
        'heures': 36.0,
        'commentaire': '',
      });
    });

    test('omits stage_id when not provided', () {
      final draft = const JournalDraft(travaux: 'x');
      expect(draft.toJson().containsKey('stage_id'), isFalse);
    });
  });
}
