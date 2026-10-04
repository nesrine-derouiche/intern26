import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/pointage.dart';

void main() {
  group('PointageStatut', () {
    test('parses known values and returns null for unknown', () {
      expect(PointageStatut.fromValue('PRESENT'), PointageStatut.present);
      expect(PointageStatut.fromValue('RETARD'), PointageStatut.retard);
      expect(PointageStatut.fromValue('ABSENT'), PointageStatut.absent);
      expect(PointageStatut.fromValue('INCONNU'), isNull);
      expect(PointageStatut.fromValue(null), isNull);
    });

    test('exposes french labels', () {
      expect(PointageStatut.present.label, 'Présent');
      expect(PointageStatut.retard.label, 'Retard');
      expect(PointageStatut.absent.label, 'Absent');
    });

    test('exposes api values', () {
      expect(PointageStatut.present.value, 'PRESENT');
      expect(PointageStatut.retard.value, 'RETARD');
      expect(PointageStatut.absent.value, 'ABSENT');
    });
  });

  group('Pointage.fromJson', () {
    test('parses a full row from the API', () {
      final pointage = Pointage.fromJson({
        'id': 'p1',
        'stage_id': 's1',
        'date_pointage': '2026-01-15',
        'heure_entree': '09:05:00',
        'heure_sortie': '17:00:00',
        'duree_minutes': 475,
        'retard_minutes': 5,
        'statut': 'RETARD',
        'commentaire': 'Retard transport',
        'created_at': '2026-01-15T09:05:00.000Z',
        'updated_at': '2026-01-15T17:00:00.000Z',
        'stagiaire_nom': 'Trabelsi',
        'stagiaire_prenom': 'Fatma',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
        'departement_nom': 'Informatique',
      });

      expect(pointage.id, 'p1');
      expect(pointage.stageId, 's1');
      expect(pointage.datePointage, DateTime(2026, 1, 15));
      expect(pointage.heureEntree, '09:05:00');
      expect(pointage.heureSortie, '17:00:00');
      expect(pointage.dureeMinutes, 475);
      expect(pointage.retardMinutes, 5);
      expect(pointage.statut, PointageStatut.retard);
      expect(pointage.commentaire, 'Retard transport');
      expect(pointage.stagiaireFullName, 'Fatma Trabelsi');
      expect(pointage.departementNom, 'Informatique');
      expect(pointage.hasEntry, isTrue);
      expect(pointage.hasExit, isTrue);
      expect(pointage.isJourneeTerminee, isTrue);
    });

    test('defaults gracefully for missing fields', () {
      final pointage = Pointage.fromJson({'id': 'p2'});

      expect(pointage.id, 'p2');
      expect(pointage.stageId, '');
      expect(pointage.datePointage, isNull);
      expect(pointage.heureEntree, isNull);
      expect(pointage.heureSortie, isNull);
      expect(pointage.dureeMinutes, isNull);
      expect(pointage.retardMinutes, 0);
      expect(pointage.statut, PointageStatut.present);
      expect(pointage.stagiaireFullName, '');
      expect(pointage.hasEntry, isFalse);
      expect(pointage.hasExit, isFalse);
      expect(pointage.isJourneeTerminee, isFalse);
    });

    test('hasEntry is false when heure_entree is empty', () {
      final pointage = Pointage.fromJson({'id': 'p3', 'heure_entree': ''});
      expect(pointage.hasEntry, isFalse);
      expect(pointage.heureEntreeLabel, '—');
    });

    test('hasExit is true only when heure_sortie exists', () {
      final pointage = Pointage.fromJson({
        'id': 'p4',
        'heure_entree': '09:00:00',
        'heure_sortie': null,
      });
      expect(pointage.hasEntry, isTrue);
      expect(pointage.hasExit, isFalse);
      expect(pointage.isJourneeTerminee, isFalse);
    });
  });

  group('Pointage helpers', () {
    test('heureEntreeLabel formats time as HH:mm', () {
      final p = Pointage.fromJson({'id': 'p', 'heure_entree': '09:05:00'});
      expect(p.heureEntreeLabel, '09h05');
    });

    test('heureSortieLabel formats time as HH:mm', () {
      final p = Pointage.fromJson({'id': 'p', 'heure_sortie': '17:30:00'});
      expect(p.heureSortieLabel, '17h30');
    });

    test('dureeLabel formats minutes as h and min', () {
      expect(
        Pointage.fromJson({'id': 'p', 'duree_minutes': 475}).dureeLabel,
        '7h55',
      );
      expect(
        Pointage.fromJson({'id': 'p', 'duree_minutes': 60}).dureeLabel,
        '1h',
      );
      expect(
        Pointage.fromJson({'id': 'p', 'duree_minutes': 45}).dureeLabel,
        '45min',
      );
      expect(
        Pointage.fromJson({'id': 'p', 'duree_minutes': 0}).dureeLabel,
        '0min',
      );
      expect(
        Pointage.fromJson({'id': 'p'}).dureeLabel,
        '—',
      );
    });

    test('retardLabel formats delay with + prefix', () {
      expect(
        Pointage.fromJson({'id': 'p', 'retard_minutes': 5}).retardLabel,
        '+5min',
      );
      expect(
        Pointage.fromJson({'id': 'p', 'retard_minutes': 0}).retardLabel,
        '',
      );
      expect(
        Pointage.fromJson({'id': 'p'}).retardLabel,
        '',
      );
    });

    test('stagiaireFullName trims and joins names', () {
      final p = Pointage.fromJson({
        'id': 'p',
        'stagiaire_prenom': ' Fatma ',
        'stagiaire_nom': ' Trabelsi',
      });
      expect(p.stagiaireFullName, 'Fatma Trabelsi');
    });

    test('dateLabel uses formatDateFr', () {
      final p = Pointage.fromJson({'id': 'p', 'date_pointage': '2026-01-15'});
      expect(p.dateLabel, '15/01/2026');
    });

    test('statutLabel maps to french label', () {
      expect(
        Pointage.fromJson({'id': 'p', 'statut': 'ABSENT'}).statutLabel,
        'Absent',
      );
    });
  });

  group('Horaire.fromJson', () {
    test('parses a full row', () {
      final horaire = Horaire.fromJson({
        'heure_debut': '08:30',
        'heure_fin': '16:30',
        'duree_pause_minutes': 45,
      });

      expect(horaire.heureDebut, '08:30');
      expect(horaire.heureFin, '16:30');
      expect(horaire.dureePauseMinutes, 45);
      expect(horaire.horaireLabel, '08h30 — 16h30');
      expect(horaire.pauseLabel, 'Pause : 45min');
    });

    test('defaults gracefully for missing fields', () {
      final horaire = Horaire.fromJson({});

      expect(horaire.heureDebut, '09:00');
      expect(horaire.heureFin, '17:00');
      expect(horaire.dureePauseMinutes, 60);
      expect(horaire.horaireLabel, '09h00 — 17h00');
    });
  });

  group('PointageStats.fromJson', () {
    test('parses a full row', () {
      final stats = PointageStats.fromJson({
        'total_jours': 20,
        'presents': 18,
        'retards': 1,
        'absents': 1,
        'total_minutes': 9600,
        'moyenne_minutes': 480.5,
        'total_retard_minutes': 15,
      });

      expect(stats.totalJours, 20);
      expect(stats.presents, 18);
      expect(stats.retards, 1);
      expect(stats.absents, 1);
      expect(stats.totalMinutes, 9600);
      expect(stats.moyenneMinutes, 480.5);
      expect(stats.totalRetardMinutes, 15);
      expect(stats.totalHeuresLabel, '160h00');
      expect(stats.tauxPresence, 90.0);
    });

    test('defaults gracefully for missing fields', () {
      final stats = PointageStats.fromJson({});

      expect(stats.totalJours, 0);
      expect(stats.presents, 0);
      expect(stats.tauxPresence, 0);
      expect(stats.totalHeuresLabel, '0h00');
    });

    test('tauxPresence handles partial hours', () {
      final stats = PointageStats.fromJson({
        'total_jours': 10,
        'presents': 7,
      });
      expect(stats.tauxPresence, 70.0);
    });

    test('parses the real API payload where pg sends numbers as strings', () {
      final stats = PointageStats.fromJson({
        'total_jours': '1',
        'presents': '0',
        'retards': '1',
        'absents': '0',
        'total_minutes': '0',
        'moyenne_minutes': '0.00000000000000000000',
        'total_retard_minutes': '15',
      });

      expect(stats.totalJours, 1);
      expect(stats.presents, 0);
      expect(stats.retards, 1);
      expect(stats.absents, 0);
      expect(stats.moyenneMinutes, 0);
      expect(stats.totalRetardMinutes, 15);
    });
  });
}
