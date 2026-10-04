import 'package:flutter_test/flutter_test.dart';
import 'package:steg_app/models/app_notification.dart';
import 'package:steg_app/models/dashboard_stats.dart';
import 'package:steg_app/models/document_item.dart';
import 'package:steg_app/models/internship.dart';
import 'package:steg_app/models/reunion.dart';
import 'package:steg_app/models/tache.dart';

void main() {
  group('DashboardStats', () {
    test('fromJson parses a realistic stagiaire payload', () {
      final stats = DashboardStats.fromJson({
        'notificationsNonLues': 6,
        'stagesTotal': 1,
        'stagesEnCours': 1,
        'stagesTermines': 0,
        'tachesTotal': 4,
        'tachesEnCours': 1,
        'tachesTerminees': 2,
        'tachesAFaire': 1,
        'tachesBloquees': 0,
        'tachesEnRetard': 0,
        'candidaturesTotal': 3,
        'candidaturesEnAttente': 2,
        'candidaturesAcceptees': 1,
        'departements': [
          {
            'id': 'dept-1',
            'nom': 'Informatique',
            'nb_encadrants': '1',
            'nb_stages_actifs': '1',
          },
        ],
        'recentStages': [
          {
            'id': 'stage-1',
            'date_debut': '2026-01-14T23:00:00.000Z',
            'date_fin': '2026-07-14T23:00:00.000Z',
            'statut': 'EN_COURS',
            'stagiaire_nom': 'Trabelsi',
            'stagiaire_prenom': 'Fatma',
            'encadrant_nom': 'Ben Salah',
            'encadrant_prenom': 'Ahmed',
            'departement_nom': 'Informatique',
            'offre_titre': 'Développeur Angular',
          },
        ],
        'prochainsStages': [],
        'prochainesReunions': [],
        'recentDocuments': [],
        'recentNotifications': [
          {
            'id': 'notif-1',
            'utilisateur_id': 'user-1',
            'titre': 'Nouvelle tâche',
            'message': 'Tâche assignée',
            'date': '2026-07-31T13:24:54.273Z',
            'type': 'TACHE',
            'lue': false,
          },
        ],
        'topEncadrants': [
          {
            'encadrant_id': 'enc-1',
            'nom': 'Ben Salah',
            'prenom': 'Ahmed',
            'nb_stages': 1,
            'nb_actifs': 1,
          },
        ],
        'repartitionStatutsStages': [
          {'statut': 'EN_COURS', 'total': 1},
        ],
      });

      expect(stats.notificationsNonLues, 6);
      expect(stats.tachesAFaire, 1);
      expect(stats.tachesEnCours, 1);
      expect(stats.departements.single.nom, 'Informatique');
      expect(stats.departements.single.nbEncadrants, 1);
      expect(stats.departements.single.nbStagesActifs, 1);
      expect(stats.recentNotifications.single.lue, isFalse);
      expect(stats.supervisor?.encadrantId, 'enc-1');
      expect(stats.supervisor?.fullName, 'Ahmed Ben Salah');
    });

    test('internship prefers the active stage and matches department', () {
      final stats = DashboardStats.fromJson({
        'recentStages': [
          {
            'id': 's-1',
            'statut': 'TERMINE',
            'offre_titre': 'Ancien',
          },
          {
            'id': 's-2',
            'statut': 'EN_COURS',
            'offre_titre': 'Actuel',
            'departement_nom': 'Informatique',
          },
        ],
        'departements': [
          {'id': 'd-1', 'nom': 'Informatique', 'nb_encadrants': 1, 'nb_stages_actifs': 2},
        ],
      });

      expect(stats.internship?.id, 's-2');
      expect(stats.departmentFor('Informatique')?.nbStagesActifs, 2);
    });

    test('internship falls back to upcoming stages when none exists', () {
      final stats = DashboardStats.fromJson({
        'recentStages': [],
        'prochainsStages': [
          {'id': 's-3', 'statut': 'EN_COURS', 'offre_titre': 'Futur'},
        ],
      });

      expect(stats.internship?.id, 's-3');
    });

    test('missing fields default safely', () {
      final stats = DashboardStats.fromJson({});
      expect(stats.notificationsNonLues, 0);
      expect(stats.recentStages, isEmpty);
      expect(stats.internship, isNull);
      expect(stats.supervisor, isNull);
    });
  });

  group('Internship', () {
    test('terminated stage shows 100% progress', () {
      final internship = Internship.fromJson({
        'id': 's-1',
        'date_debut': '2026-01-15',
        'date_fin': '2026-07-15',
        'statut': 'TERMINE',
      });
      expect(internship.progress, 100);
      expect(internship.isActive, isFalse);
    });

    test('future stage progress is clamped to 0', () {
      final internship = Internship.fromJson({
        'id': 's-1',
        'date_debut': '2027-01-15',
        'date_fin': '2027-06-15',
        'statut': 'EN_COURS',
      });
      expect(internship.progress, 0);
      expect(internship.isActive, isTrue);
    });

    test('computed labels', () {
      final internship = Internship.fromJson({
        'id': 's-1',
        'date_debut': '2026-01-15',
        'date_fin': '2026-03-15',
        'statut': 'EN_COURS',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
        'offre_titre': '',
      });
      expect(internship.titre, 'Stage');
      expect(internship.encadrantFullName, 'Ahmed Ben Salah');
      expect(internship.dureeSemaines, 8);
      expect(internship.periodeLabel, contains('Du 15/01/2026'));
    });
  });

  group('Tache', () {
    test('fromJson parses fields and labels', () {
      final tache = Tache.fromJson({
        'id': 't-1',
        'projet_titre': 'Dashboard',
        'createur_nom': 'Ben Salah',
        'createur_prenom': 'Ahmed',
        'titre': 'Créer le schéma',
        'description': 'DDL',
        'priorite': 'HAUTE',
        'statut': 'EN_COURS',
        'progress': 40,
        'estimated_hours': 2,
        'spent_hours': 1,
      });

      expect(tache.titre, 'Créer le schéma');
      expect(tache.createurFullName, 'Ahmed Ben Salah');
      expect(TacheStatut.fromValue(tache.statut), TacheStatut.enCours);
      expect(TachePriorite.fromValue(tache.priorite), TachePriorite.haute);
      expect(tache.echeanceLabel, 'Sans échéance');
    });

    test('estEnRetard is true for overdue unfinished tasks', () {
      final overdue = Tache.fromJson({
        'id': 't-1',
        'date_fin': '2020-01-01',
        'statut': 'EN_COURS',
      });
      expect(overdue.estEnRetard, isTrue);

      final done = Tache.fromJson({
        'id': 't-2',
        'date_fin': '2020-01-01',
        'statut': 'TERMINEE',
      });
      expect(done.estEnRetard, isFalse);
    });
  });

  group('Reunion', () {
    test('fromJson formats time and flags upcoming', () {
      final upcoming = Reunion.fromJson({
        'id': 'r-1',
        'stage_id': 's-1',
        'date': '2099-01-01',
        'heure': '10:30:00',
        'salle': 'B204',
        'sujet': 'Point projet',
        'encadrant_nom': 'Ben Salah',
        'encadrant_prenom': 'Ahmed',
      });
      expect(upcoming.heureLabel, '10h30');
      expect(upcoming.estAVenir, isTrue);
      expect(upcoming.encadrantFullName, 'Ahmed Ben Salah');

      final past = Reunion.fromJson({'id': 'r-2', 'date': '2020-01-01'});
      expect(past.estAVenir, isFalse);
    });
  });

  group('DocumentItem', () {
    test('type label and extension', () {
      final doc = DocumentItem.fromJson({
        'id': 'd-1',
        'stage_id': 's-1',
        'type': 'CONVENTION',
        'nom': 'convention.pdf',
        'chemin': '/uploads/x.pdf',
        'date_depot': '2026-07-31T10:00:00.000Z',
      });
      expect(doc.typeLabel, 'Convention');
      expect(doc.extension, 'PDF');

      final unknown = DocumentItem.fromJson({'id': 'd-2', 'type': 'AUTRE', 'nom': 'doc'});
      expect(unknown.typeLabel, 'AUTRE');
      expect(unknown.extension, '');
    });
  });

  group('AppNotification', () {
    test('copyWith updates read flag only', () {
      final notification = AppNotification.fromJson({
        'id': 'n-1',
        'titre': 'Titre',
        'message': 'Message',
        'type': 'INFO',
        'lue': false,
      });
      final updated = notification.copyWith(lue: true);
      expect(updated.lue, isTrue);
      expect(updated.id, 'n-1');
      expect(updated.titre, 'Titre');
    });
  });
}
