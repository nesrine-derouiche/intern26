require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || ''
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hashPassword = async (pwd) => bcrypt.hash(pwd, 12);

    // ── Utilisateurs ──────────────────────────────────────────────
    const encadrantPwd = await hashPassword(process.env.SEED_PASSWORD_ENCADRANT || 'encadrant123');
    const stagiairePwd = await hashPassword(process.env.SEED_PASSWORD_STAGIAIRE || 'stagiaire123');
    const chefPwd = await hashPassword(process.env.SEED_PASSWORD_CHEF || 'chef123');
    const rhPwd = await hashPassword(process.env.SEED_PASSWORD_RH || 'rh1234');
    const adminPwd = await hashPassword(process.env.SEED_PASSWORD_ADMIN || 'admin123');

    // Admin
    const adminRes = await client.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, role)
       VALUES ('Ben Ahmed', 'Sami', 'admin@steg.tn', $1, 'ADMIN') RETURNING id`,
      [adminPwd]
    );
    await client.query('INSERT INTO administrateur (id) VALUES ($1)', [adminRes.rows[0].id]);

    // Chef de département
    const chefRes = await client.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
       VALUES ('Khelifi', 'Nabil', 'nabil.khelifi@steg.tn', $1, '+216 71 123 456', 'CHEF_DEPARTEMENT') RETURNING id`,
      [chefPwd]
    );
    await client.query('INSERT INTO chef_departement (id) VALUES ($1)', [chefRes.rows[0].id]);

    // RH
    const rhRes = await client.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
       VALUES ('Bouazizi', 'Salma', 'salma.bouazizi@steg.tn', $1, '+216 71 234 567', 'RH') RETURNING id`,
      [rhPwd]
    );
    await client.query('INSERT INTO rh (id) VALUES ($1)', [rhRes.rows[0].id]);

    // Départements
    const deptInfoRes = await client.query(
      `INSERT INTO departement (nom, description) VALUES ('Informatique', 'Département des systèmes d''information et développement') RETURNING id`
    );
    const deptElecRes = await client.query(
      `INSERT INTO departement (nom, description) VALUES ('Électromécanique', 'Département de maintenance et équipements') RETURNING id`
    );
    const deptFinanceRes = await client.query(
      `INSERT INTO departement (nom, description) VALUES ('Finance', 'Département comptabilité et finances') RETURNING id`
    );

    // Update chef to lead informatique
    await client.query('UPDATE departement SET chef_departement_id = $1 WHERE id = $2', [chefRes.rows[0].id, deptInfoRes.rows[0].id]);

    // Encadrants
    const enc1Res = await client.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
       VALUES ('Ben Salah', 'Ahmed', 'ahmed.bensalah@steg.tn', $1, '+216 71 345 678', 'ENCADRANT') RETURNING id`,
      [encadrantPwd]
    );
    await client.query(
      'INSERT INTO encadrant (id, service, nombre_max_stagiaires, competences, departement_id) VALUES ($1, $2, $3, $4, $5)',
      [enc1Res.rows[0].id, 'Développement Web', 5, 'Angular, Node.js, PostgreSQL, Python', deptInfoRes.rows[0].id]
    );

    const enc2Res = await client.query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
       VALUES ('Mansour', 'Rachid', 'rachid.mansour@steg.tn', $1, '+216 71 456 789', 'ENCADRANT') RETURNING id`,
      [encadrantPwd]
    );
    await client.query(
      'INSERT INTO encadrant (id, service, nombre_max_stagiaires, competences, departement_id) VALUES ($1, $2, $3, $4, $5)',
      [enc2Res.rows[0].id, 'Maintenance Réseau', 3, 'Réseaux, Systèmes Linux, Cisco', deptElecRes.rows[0].id]
    );

    // Stagiaires
    const stagData = [
      { nom: 'Trabelsi', prenom: 'Fatma', email: 'fatma.trabelsi@steg.tn', ecole: 'ENSI', specialite: 'Génie Logiciel', niveau: 'Master 2', competences: 'Angular, Java, SQL' },
      { nom: 'Hadj Ali', prenom: 'Youssef', email: 'youssef.hadjali@steg.tn', ecole: 'ISAMM', specialite: 'Data Science', niveau: 'Master 1', competences: 'Python, Machine Learning, SQL' },
      { nom: 'Gharbi', prenom: 'Nour', email: 'nour.gharbi@steg.tn', ecole: 'FST', specialite: 'Électrotechnique', niveau: 'Licence', competences: 'C++, Matlab, Électronique' },
      { nom: 'Bouchnak', prenom: 'Mohamed', email: 'mohamed.bouchnak@steg.tn', ecole: 'ENIT', specialite: 'Réseaux', niveau: 'Master 2', competences: 'Cisco, Linux, Python' },
      { nom: 'Mejri', prenom: 'Amira', email: 'amira.mejri@steg.tn', ecole: 'ISSAT', specialite: 'Finance', niveau: 'Master 1', competences: 'Excel, SAP, Comptabilité' }
    ];

    const stagIds = [];
    for (const s of stagData) {
      const res = await client.query(
        `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
         VALUES ($1, $2, $3, $4, $5, 'STAGIAIRE') RETURNING id`,
        [s.nom, s.prenom, s.email, stagiairePwd, '+216 98 000 000']
      );
      await client.query(
        'INSERT INTO stagiaire (id, ecole, specialite, niveau, competences) VALUES ($1, $2, $3, $4, $5)',
        [res.rows[0].id, s.ecole, s.specialite, s.niveau, s.competences]
      );
      stagIds.push(res.rows[0].id);
    }

    // Offres de stage
    const offre1Res = await client.query(
      `INSERT INTO offre_stage (departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite)
       VALUES ($1, 'Développeur Angular - Application interne', 'Développement d''une application web de gestion des stages avec Angular et Node.js', 24, 'Angular, TypeScript, Node.js', 2, '2026-09-30') RETURNING id`,
      [deptInfoRes.rows[0].id]
    );
    const offre2Res = await client.query(
      `INSERT INTO offre_stage (departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite)
       VALUES ($1, 'Technicien Réseau', 'Installation et maintenance du réseau local des bureaux STEG', 16, 'Réseaux, Linux, Cisco', 1, '2026-08-15') RETURNING id`,
      [deptElecRes.rows[0].id]
    );

    // Candidatures
    const cand1Res = await client.query(
      `INSERT INTO candidature (stagiaire_id, offre_id, statut) VALUES ($1, $2, 'ACCEPTEE') RETURNING id`,
      [stagIds[0], offre1Res.rows[0].id]
    );
    const cand2Res = await client.query(
      `INSERT INTO candidature (stagiaire_id, offre_id, statut) VALUES ($1, $2, 'ACCEPTEE') RETURNING id`,
      [stagIds[3], offre2Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO candidature (stagiaire_id, offre_id, statut) VALUES ($1, $2, 'EN_ATTENTE')`,
      [stagIds[1], offre1Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO candidature (stagiaire_id, offre_id, statut) VALUES ($1, $2, 'EN_ATTENTE')`,
      [stagIds[2], offre2Res.rows[0].id]
    );

    // Stages
    const stage1Res = await client.query(
      `INSERT INTO stage (candidature_id, stagiaire_id, encadrant_id, departement_id, offre_id, date_debut, date_fin, statut)
       VALUES ($1, $2, $3, $4, $5, '2026-01-15', '2026-07-15', 'EN_COURS') RETURNING id`,
      [cand1Res.rows[0].id, stagIds[0], enc1Res.rows[0].id, deptInfoRes.rows[0].id, offre1Res.rows[0].id]
    );
    const stage2Res = await client.query(
      `INSERT INTO stage (candidature_id, stagiaire_id, encadrant_id, departement_id, offre_id, date_debut, date_fin, statut)
       VALUES ($1, $2, $3, $4, $5, '2026-02-01', '2026-08-01', 'EN_COURS') RETURNING id`,
      [cand2Res.rows[0].id, stagIds[3], enc2Res.rows[0].id, deptElecRes.rows[0].id, offre2Res.rows[0].id]
    );

    // Projets
    const projet1Res = await client.query(
      `INSERT INTO projet (stage_id, titre, description, technologies, avancement)
       VALUES ($1, 'Dashboard de Gestion des Stages', 'Application web Angular pour gérer les stagiaires, tâches et évaluations', 'Angular 22, PostgreSQL, Express.js', 65) RETURNING id`,
      [stage1Res.rows[0].id]
    );
    const projet2Res = await client.query(
      `INSERT INTO projet (stage_id, titre, description, technologies, avancement)
       VALUES ($1, 'Réseau Bureau 3ème étage', 'Installation et câblage du réseau local', 'Câblage RJ45, Switches Cisco', 30) RETURNING id`,
      [stage2Res.rows[0].id]
    );

    // Tâches
    const tacheData = [
      { projet: projet1Res.rows[0].id, createur: enc1Res.rows[0].id, executant: stagIds[0], titre: 'Créer le schéma de la base de données', desc: 'Modéliser le MCD/MLD et exécuter le DDL', priorite: 'HAUTE', statut: 'TERMINEE' },
      { projet: projet1Res.rows[0].id, createur: enc1Res.rows[0].id, executant: stagIds[0], titre: 'Développer le module Authentification', desc: 'JWT, login, register, guards', priorite: 'HAUTE', statut: 'TERMINEE' },
      { projet: projet1Res.rows[0].id, createur: enc1Res.rows[0].id, executant: stagIds[0], titre: 'Développer le CRUD Stagiaires', desc: 'API + Frontend Angular pour gérer les stagiaires', priorite: 'MOYENNE', statut: 'EN_COURS' },
      { projet: projet1Res.rows[0].id, createur: enc1Res.rows[0].id, executant: stagIds[0], titre: 'Intégrer les notifications push', desc: 'Système de notifications en temps réel', priorite: 'BASSE', statut: 'A_FAIRE' },
      { projet: projet2Res.rows[0].id, createur: enc2Res.rows[0].id, executant: stagIds[3], titre: 'Câbler les bureaux B301-B305', desc: 'Installation des prises RJ45', priorite: 'HAUTE', statut: 'EN_COURS' },
      { projet: projet2Res.rows[0].id, createur: enc2Res.rows[0].id, executant: stagIds[3], titre: 'Configurer les switches', desc: 'Configuration VLANs et sécurité', priorite: 'MOYENNE', statut: 'A_FAIRE' }
    ];

    for (const t of tacheData) {
      await client.query(
        `INSERT INTO tache (projet_id, createur_id, executant_id, titre, description, priorite, statut)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.projet, t.createur, t.executant, t.titre, t.desc, t.priorite, t.statut]
      );
    }

    // Rapports
    await client.query(
      `INSERT INTO rapport (stage_id, type, contenu, statut) VALUES ($1, 'INTERMEDIAIRE', 'Bilan du premier semestre : bonne progression sur le projet dashboard', 'VALIDE')`,
      [stage1Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO rapport (stage_id, type, contenu, statut) VALUES ($1, 'INTERMEDIAIRE', 'Avancement de l''installation réseau : 3 bureaux câblés sur 5', 'SOUMIS')`,
      [stage2Res.rows[0].id]
    );

    // Évaluations
    await client.query(
      `INSERT INTO evaluation (stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire)
       VALUES ($1, $2, 16, 17, 15, 18, 16, 16.40, 'Bon travail, très autonome et ponctuelle')`,
      [stage1Res.rows[0].id, enc1Res.rows[0].id]
    );

    // Réunions
    await client.query(
      `INSERT INTO reunion (stage_id, date, heure, salle, sujet) VALUES ($1, '2026-07-22', '10:00', 'Salle B204', 'Point d''avancement projet dashboard')`,
      [stage1Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO reunion (stage_id, date, heure, salle, sujet) VALUES ($1, '2026-07-25', '14:30', 'Salle B102', 'Bilan installation réseau')`,
      [stage2Res.rows[0].id]
    );

    // Journaux hebdomadaires
    const journalData = [
      {
        stage_id: stage1Res.rows[0].id, semaine: '2026-01-15', heures: 35, statut: 'SOUMIS',
        travaux: 'Découverte du projet Dashboard de gestion des stages et configuration de l\'environnement Angular.',
        difficultes: 'Compréhension de l\'architecture du monorepo et configuration du proxy.',
        solutions: 'Documentation interne STEG et accompagnement de l\'encadrant.',
        competences: 'Angular, Git, environnement de travail STEG.'
      },
      {
        stage_id: stage1Res.rows[0].id, semaine: '2026-01-22', heures: 37, statut: 'VALIDE',
        travaux: 'Modélisation de la base de données (MCD/MLD) et création du schéma PostgreSQL.',
        difficultes: 'Choix des contraintes d\'intégrité et des index pertinents.',
        solutions: 'Revue de schéma avec l\'encadrant et itérations sur le DDL.',
        competences: 'PostgreSQL, modélisation de données, SQL avancé.'
      },
      {
        stage_id: stage2Res.rows[0].id, semaine: '2026-02-03', heures: 34, statut: 'BROUILLON',
        travaux: 'Inventaire du réseau du 3ème étage et plan de câblage.',
        difficultes: 'Identification des points de passage du câblage.',
        solutions: 'Repérage sur site avec le service maintenance.',
        competences: 'Réseaux, câblage RJ45, Cisco.'
      }
    ];

    for (const j of journalData) {
      await client.query(
        `INSERT INTO journal (stage_id, semaine, travaux, difficultes, solutions, competences, heures, statut)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [j.stage_id, j.semaine, j.travaux, j.difficultes, j.solutions, j.competences, j.heures, j.statut]
      );
    }

    // Notifications
    const seedNotifications = [
      // Stagiaire Fatma Trabelsi (stagIds[0])
      [stagIds[0], 'Nouvelle tâche', 'Vous avez une nouvelle tâche : Créer le schéma de la base de données', 'TACHE'],
      [stagIds[0], 'Réunion prévue', "Réunion le 22/07 à 10h - Point d'avancement projet dashboard", 'REUNION'],
      [stagIds[0], 'Rapport validé', 'Votre rapport intermédiaire a été validé par votre encadrant', 'RAPPORT'],
      [stagIds[0], 'Stage actif', 'Votre stage a démarré le 15/01/2026. Bonne continuation !', 'STAGE'],
      [stagIds[0], 'Évaluation disponible', 'Votre encadrant a publié votre évaluation de mi-stage', 'EVALUATION'],
      [stagIds[0], 'Candidature acceptée', 'Félicitations, votre candidature a été acceptée', 'CANDIDATURE'],
      // Stagiaire Mohamed Bouchnak (stagIds[3])
      [stagIds[3], 'Nouvelle tâche', 'Vous avez une nouvelle tâche : Câbler les bureaux B301-B305', 'TACHE'],
      [stagIds[3], 'Réunion prévue', 'Réunion le 25/07 à 14h30 - Bilan installation réseau', 'REUNION'],
      [stagIds[3], 'Rapport soumis', 'Votre rapport intermédiaire est en cours de validation', 'RAPPORT'],
      [stagIds[3], 'Document requis', 'Merci de déposer votre attestation de convention', 'DOCUMENT'],
      [stagIds[3], 'Stage actif', 'Votre stage a démarré le 01/02/2026. Bonne continuation !', 'STAGE'],
      // Encadrant Ahmed Ben Salah (enc1Res)
      [enc1Res.rows[0].id, 'Document déposé', 'Fatma Trabelsi a déposé un document : Convention', 'DOCUMENT'],
      [enc1Res.rows[0].id, 'Tâche terminée', 'La tâche « Créer le schéma de la base de données » a été terminée', 'TACHE'],
      [enc1Res.rows[0].id, 'Réunion confirmée', 'Réunion le 22/07 à 10h avec Fatma Trabelsi', 'REUNION'],
      // Encadrant Rachid Mansour (enc2Res)
      [enc2Res.rows[0].id, 'Rapport à valider', 'Mohamed Bouchnak a soumis son rapport intermédiaire', 'RAPPORT'],
      [enc2Res.rows[0].id, 'Évaluation à remplir', "Merci d'évaluer Mohamed Bouchnak pour son stage", 'EVALUATION'],
      [enc2Res.rows[0].id, 'Candidature liée', 'La candidature de Mohamed Bouchnak a été acceptée', 'CANDIDATURE'],
      // Admin Sami Ben Ahmed (adminRes)
      [adminRes.rows[0].id, 'Nouveau stage', 'Un nouveau stage a été créé dans le département Informatique', 'STAGE'],
      [adminRes.rows[0].id, 'Candidature en attente', 'Une candidature attend une décision (Développeur Angular)', 'CANDIDATURE'],
      [adminRes.rows[0].id, 'Évaluation publiée', 'Ahmed Ben Salah a publié une évaluation', 'EVALUATION']
    ];
    for (const [utilisateurId, titre, message, type] of seedNotifications) {
      await client.query(
        `INSERT INTO notification (utilisateur_id, titre, message, type) VALUES ($1, $2, $3, $4)`,
        [utilisateurId, titre, message, type]
      );
    }

    await client.query('COMMIT');
    console.log('Seed terminé avec succès !');
    console.log('\nComptes de démonstration :');
    console.log('  Admin:     admin@steg.tn / admin123');
    console.log('  Encadrant: ahmed.bensalah@steg.tn / encadrant123');
    console.log('  Stagiaire: fatma.trabelsi@steg.tn / stagiaire123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur seed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
