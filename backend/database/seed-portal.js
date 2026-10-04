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

const INFO = '71fca91c-fdba-451c-aec7-a413aac61841';
const ELEC = '62345637-3691-476c-8335-01744e2a9433';
const FINANCE = 'e7daeccb-5e93-4bf9-9566-30d9a20a108e';
const ENC_INFO = '21dca611-c2a5-4c49-a261-2157639cec1a';
const ENC_ELEC = '84922a14-d00c-43b9-bbc7-6fd849a689c6';

async function seedPortal() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Compte candidat de démonstration (email vérifié) ─────────
    const candEmail = 'candidat@steg.tn';
    const existing = await client.query('SELECT id FROM utilisateur WHERE email = $1', [candEmail]);
    if (existing.rows.length === 0) {
      const pwd = await bcrypt.hash(process.env.SEED_PASSWORD_CANDIDAT || 'Candidat123!', 12);
      const res = await client.query(
        `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, adresse, role, email_verifie)
         VALUES ('Sassi', 'Marwa', $1, $2, '+216 22 555 888', 'Tunis, La Marsa', 'CANDIDAT', true)
         RETURNING id`,
        [candEmail, pwd]
      );
      await client.query(
        `INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, github, linkedin)
         VALUES ($1, 'INSAT', 'Génie Logiciel', 'Master 2',
                 'Angular, TypeScript, Node.js, PostgreSQL, Git',
                 'Français, Anglais, Arabe',
                 'https://github.com/marwa-sassi', 'https://www.linkedin.com/in/marwa-sassi')`,
        [res.rows[0].id]
      );
    }

    // ── Enrichissement des offres existantes ─────────────────────
    await client.query(
      `UPDATE offre_stage SET
         missions = $1,
         technologies = $2,
         documents_demandes = $3,
         localisation = $4,
         niveau = $5,
         encadrant_id = $6
       WHERE titre = 'Développeur Angular - Application interne'`,
      [
        "Participer au développement de l'application web de gestion des stages ;\n" +
          "Concevoir et implémenter les composants Angular ;\n" +
          "Développer les API REST avec Node.js/Express ;\n" +
          "Écrire et exécuter les tests unitaires et d'intégration.",
        'Angular, TypeScript, Node.js, Express, PostgreSQL, Git',
        'CV, Lettre de motivation, Convention de stage, Relevé de notes',
        'Tunis, Avenue de la Liberté',
        'Master',
        ENC_INFO
      ]
    );

    await client.query(
      `UPDATE offre_stage SET
         missions = $1,
         technologies = $2,
         documents_demandes = $3,
         localisation = $4,
         niveau = $5,
         encadrant_id = $6
       WHERE titre = 'Technicien Réseau'`,
      [
        "Installer et configurer les équipements réseau ;\n" +
          "Diagnostiquer et résoudre les incidents réseau ;\n" +
          "Assurer la maintenance préventive et corrective ;\n" +
          "Rédiger la documentation technique.",
        'Cisco, Linux, TCP/IP, VLAN, Pare-feu',
        'CV, Lettre de motivation, Convention de stage',
        'Tunis, Zone industrielle',
        'Licence',
        ENC_ELEC
      ]
    );

    // ── Nouvelles offres du portail ──────────────────────────────
    const offres = [
      {
        titre: 'Développeur Node.js – API REST',
        departement_id: INFO,
        description: "Conception et développement d'APIs REST performantes pour les applications internes STEG.",
        duree: 20,
        competences_demandees: 'Node.js, Express, PostgreSQL, REST API, Git',
        nombre_places: 2,
        date_limite: '2026-10-15',
        missions:
          "Concevoir l'architecture des APIs REST ;\n" +
          "Implémenter l'authentification JWT ;\n" +
          'Optimiser les requêtes SQL et les index ;\n' +
          'Rédiger la documentation Swagger.',
        technologies: 'Node.js, Express, PostgreSQL, JWT, Swagger',
        documents_demandes: 'CV, Lettre de motivation, Convention de stage, Relevé de notes',
        localisation: 'Tunis, Avenue de la Liberté',
        niveau: 'Master',
        encadrant_id: ENC_INFO
      },
      {
        titre: 'Stagiaire Data Analyst – Tableaux de bord énergie',
        departement_id: INFO,
        description:
          'Analyse des données de consommation électrique et développement de tableaux de bord décisionnels.',
        duree: 16,
        competences_demandees: 'Python, SQL, Power BI, Excel avancé',
        nombre_places: 1,
        date_limite: '2026-11-01',
        missions:
          'Extraire et nettoyer les données de consommation ;\n' +
          'Construire des indicateurs de performance ;\n' +
          'Développer des tableaux de bord Power BI ;\n' +
          "Présenter les analyses aux équipes.",
        technologies: 'Python, SQL, Power BI, Pandas, Excel',
        documents_demandes: 'CV, Lettre de motivation, Relevé de notes',
        localisation: 'Tunis, Avenue de la Liberté',
        niveau: 'Master',
        encadrant_id: ENC_INFO
      },
      {
        titre: 'Technicien Électricien de Maintenance',
        departement_id: ELEC,
        description: 'Maintenance préventive et corrective des équipements électriques des centrales STEG.',
        duree: 24,
        competences_demandees: 'Électrotechnique, Automates, Schémas électriques',
        nombre_places: 2,
        date_limite: '2026-09-20',
        missions:
          'Diagnostiquer les pannes électriques ;\n' +
          'Intervenir sur les lignes et les armoires électriques ;\n' +
          'Suivre les plans de maintenance préventive ;\n' +
          "Remplir les rapports d'intervention.",
        technologies: 'Automates programmables, Électrotechnique, Multimètre, Analyseurs',
        documents_demandes: 'CV, Lettre de motivation, Convention de stage',
        localisation: 'Radès, Centrale électrique',
        niveau: 'BTS',
        encadrant_id: ENC_ELEC
      },
      {
        titre: 'Assistant Comptable',
        departement_id: FINANCE,
        description: "Appui à l'équipe comptabilité pour la saisie, le rapprochement et le contrôle des opérations.",
        duree: 12,
        competences_demandees: 'Comptabilité générale, Excel, SAP',
        nombre_places: 1,
        date_limite: '2026-12-01',
        missions:
          'Saisir et contrôler les écritures comptables ;\n' +
          'Rapprocher les comptes clients et fournisseurs ;\n' +
          'Assister dans la préparation des états financiers ;\n' +
          'Classer et archiver les pièces comptables.',
        technologies: 'SAP, Excel, Sage',
        documents_demandes: 'CV, Lettre de motivation, Relevé de notes',
        localisation: 'Tunis, Siège social',
        niveau: 'Licence',
        encadrant_id: null
      }
    ];

    for (const o of offres) {
      await client.query(
        `INSERT INTO offre_stage
           (departement_id, titre, description, duree, competences_demandees, nombre_places, date_limite,
            missions, technologies, documents_demandes, localisation, niveau, encadrant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          o.departement_id, o.titre, o.description, o.duree, o.competences_demandees,
          o.nombre_places, o.date_limite, o.missions, o.technologies, o.documents_demandes,
          o.localisation, o.niveau, o.encadrant_id
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Seed portail terminé !');
    console.log('  Candidat: candidat@steg.tn / Candidat123!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur seed portail:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seedPortal();
