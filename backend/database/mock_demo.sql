-- ============================================================
-- MOCK DATA pour la démo (28 août 2026)
-- Pipeline complet : candidature → entretien IA → entretien RH → stage
-- + tâches, réunions, évaluations, journaux, notifications
-- ============================================================
BEGIN;

-- ── IDs existants ───────────────────────────────────────────
DO $$
DECLARE
  -- Départements
  v_dept_info   UUID := '71fca91c-fdba-451c-aec7-a413aac61841';
  v_dept_elec   UUID := '62345637-3691-476c-8335-01744e2a9433';
  v_dept_fin    UUID := 'e7daeccb-5e93-4bf9-9566-30d9a20a108e';
  -- Encadrants
  v_enc_ahmed   UUID := '21dca611-c2a5-4c49-a261-2157639cec1a';
  v_enc_rachid  UUID := '84922a14-d00c-43b9-bbc7-6fd849a689c6';
  -- Offres
  v_offre_angular UUID := '44af84b3-9b76-4a10-ab65-46ff0d58ec7c';
  v_offre_node   UUID := 'f6979f00-e715-4930-9533-f706e9fc9c61';
  v_offre_data   UUID := '733a73ec-80de-4b49-a794-3f02db2298a5';
  -- RH
  v_rh_salma    UUID;
  -- Hashes
  v_pwd         TEXT;
  -- Nouveaux IDs
  v_c1_id       UUID; v_c1_stag UUID; v_c1_cand UUID; v_c1_candat UUID;
  v_c2_id       UUID; v_c2_stag UUID; v_c2_cand UUID; v_c2_candat UUID;
  v_c3_id       UUID; v_c3_stag UUID; v_c3_cand UUID; v_c3_candat UUID;
  v_c4_id       UUID; v_c4_stag UUID; v_c4_cand UUID; v_c4_candat UUID;
  v_c5_id       UUID; v_c5_stag UUID; v_c5_cand UUID; v_c5_candat UUID;
  v_stage1      UUID; v_stage2      UUID; v_stage3      UUID;
  v_proj1       UUID; v_proj2       UUID; v_proj3       UUID;
BEGIN
  -- RH id
  SELECT id INTO v_rh_salma FROM utilisateur WHERE email = 'salma.bouazizi@steg.tn';

  -- Password hash for all mock users: 'Demo2026!'
  v_pwd := '$2b$12$LJ3m4ys4Pz0C5eK8D5eG5eZ5eG5eG5eG5eG5eG5eG5eG5eG5eG5e';

  -- ════════════════════════════════════════════════════════════
  -- CANDIDAT 1 : Inès Maalej – EN_ATTENTE (profil complet, en attente de traitement)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
    VALUES ('Maalej', 'Inès', 'ines.maalej@demo.tn', v_pwd, '+216 98 111 222', 'CANDIDAT')
    RETURNING id INTO v_c1_id;
  INSERT INTO candidat (id, universite, specialite, niveau, competences, langues)
    VALUES (v_c1_id, 'ENSIT', 'Génie Logiciel', 'Master 2', 'React, Node.js, TypeScript, Docker', 'Français, Anglais, Arabe');
  INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
    VALUES (v_c1_id, 'ENSIT', 'Génie Logiciel', 'Master 2', 'React, Node.js, TypeScript, Docker');
  v_c1_stag := v_c1_id;

  INSERT INTO candidature (candidat_id, offre_id, statut, date_candidature, internship_start_date, internship_duration_months, internship_period_validated_at)
    VALUES (v_c1_id, v_offre_angular, 'EN_ATTENTE', now() - INTERVAL '5 days', '2026-09-15', 3, NULL)
    RETURNING id INTO v_c1_cand;

  -- ════════════════════════════════════════════════════════════
  -- CANDIDAT 2 : Yasmine Ferjani – EN_ENTRETIEN_IA (session IA créée, en cours)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
    VALUES ('Ferjani', 'Yasmine', 'yasmine.ferjani@demo.tn', v_pwd, '+216 55 333 444', 'CANDIDAT')
    RETURNING id INTO v_c2_id;
  INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, github)
    VALUES (v_c2_id, 'ISAMM', 'Data Science', 'Master 2', 'Python, TensorFlow, SQL, Power BI', 'Français, Anglais', 'github.com/yasminef');
  INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
    VALUES (v_c2_id, 'ISAMM', 'Data Science', 'Master 2', 'Python, TensorFlow, SQL, Power BI');
  v_c2_stag := v_c2_id;

  INSERT INTO candidature (candidat_id, offre_id, statut, date_candidature, internship_start_date, internship_duration_months, internship_period_validated_at)
    VALUES (v_c2_id, v_offre_data, 'EN_ENTRETIEN_IA', now() - INTERVAL '10 days', '2026-09-01', 3, now() - INTERVAL '8 days')
    RETURNING id INTO v_c2_cand;

  INSERT INTO ai_interview_sessions (candidature_id, token, statut, started_at, evaluation_status)
    VALUES (v_c2_cand, 'ia-token-yasmine-demo', 'EN_COURS', now() - INTERVAL '2 hours', 'EN_ATTENTE');

  -- ════════════════════════════════════════════════════════════
  -- CANDIDAT 3 : Ahmed Ben Khalifa – AI_INTERVIEW_PASSED (score 78%, en attente RH)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
    VALUES ('Ben Khalifa', 'Ahmed', 'ahmed.benkhalifa@demo.tn', v_pwd, '+216 22 555 666', 'CANDIDAT')
    RETURNING id INTO v_c3_id;
  INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, linkedin)
    VALUES (v_c3_id, 'ENSI', 'Cybersécurité', 'Ingénieur', 'Pentesting, Réseau, Python, Linux', 'Français, Anglais', 'linkedin.com/ahmedbk');
  INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
    VALUES (v_c3_id, 'ENSI', 'Cybersécurité', 'Ingénieur', 'Pentesting, Réseau, Python, Linux');
  v_c3_stag := v_c3_id;

  INSERT INTO candidature (candidat_id, offre_id, statut, date_candidature, internship_start_date, internship_duration_months, internship_period_validated_at)
    VALUES (v_c3_id, v_offre_node, 'AI_INTERVIEW_PASSED', now() - INTERVAL '15 days', '2026-09-10', 3, now() - INTERVAL '12 days')
    RETURNING id INTO v_c3_cand;

  INSERT INTO ai_interview_sessions (candidature_id, token, statut, started_at, completed_at, evaluation_status, evaluation)
    VALUES (v_c3_cand, 'ia-token-ahmed-demo', 'TERMINE', now() - INTERVAL '13 days', now() - INTERVAL '13 days' + INTERVAL '25 minutes', 'EVALUEE',
      '{"finalScore": 78, "recommendation": "Candidat recommandé pour entretien humain", "scores": {"technique": 82, "communication": 75, "motivation": 80}}');

  -- ════════════════════════════════════════════════════════════
  -- CANDIDAT 4 : Fatma Zouari – EN_ENTRETIEN_HUMAIN (entretien planifié demain)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
    VALUES ('Zouari', 'Fatma', 'fatma.zouari@demo.tn', v_pwd, '+216 71 777 888', 'CANDIDAT')
    RETURNING id INTO v_c4_id;
  INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, portfolio)
    VALUES (v_c4_id, 'ISSAT Sousse', 'Génie Industriel', 'Ingénieur', 'Lean Manufacturing, Excel, SAP, SQL', 'Français, Anglais, Arabe', 'fatma-zouari.dev');
  INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
    VALUES (v_c4_id, 'ISSAT Sousse', 'Génie Industriel', 'Ingénieur', 'Lean Manufacturing, Excel, SAP, SQL');
  v_c4_stag := v_c4_id;

  INSERT INTO candidature (candidat_id, offre_id, statut, date_candidature, internship_start_date, internship_duration_months, internship_period_validated_at)
    VALUES (v_c4_id, v_offre_angular, 'EN_ENTRETIEN_HUMAIN', now() - INTERVAL '20 days', '2026-09-01', 3, now() - INTERVAL '16 days')
    RETURNING id INTO v_c4_cand;

  INSERT INTO ai_interview_sessions (candidature_id, token, statut, started_at, completed_at, evaluation_status, evaluation)
    VALUES (v_c4_cand, 'ia-token-fatma-demo', 'TERMINE', now() - INTERVAL '18 days', now() - INTERVAL '18 days' + INTERVAL '30 minutes', 'EVALUEE',
      '{"finalScore": 85, "recommendation": "Candidat recommandé pour entretien humain", "scores": {"technique": 88, "communication": 82, "motivation": 86}}');

  INSERT INTO human_interviews (candidature_id, date, heure, interviewer, lien_visio, statut, interviewer_email)
    VALUES (v_c4_cand, CURRENT_DATE + 1, '10:00', 'Salma Bouazizi', 'https://teams.microsoft.com/l/meetup-join/demo-fatma', 'PLANIFIE', 'salma.bouazizi@steg.tn');

  -- ════════════════════════════════════════════════════════════
  -- CANDIDAT 5 : Oussama Messaoud – HUMAN_INTERVIEW_ACCEPTED (accepté, en onboarding)
  -- ════════════════════════════════════════════════════════════
  INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone, role)
    VALUES ('Messaoud', 'Oussama', 'oussama.messaoud@demo.tn', v_pwd, '+216 50 999 000', 'CANDIDAT')
    RETURNING id INTO v_c5_id;
  INSERT INTO candidat (id, universite, specialite, niveau, competences, langues, github)
    VALUES (v_c5_id, 'ENIT', 'Réseaux & Télécom', 'Ingénieur', 'Cisco, 5G, Python, DevOps', 'Français, Anglais', 'github.com/oussamamessaoud');
  INSERT INTO stagiaire (id, ecole, specialite, niveau, competences)
    VALUES (v_c5_id, 'ENIT', 'Réseaux & Télécom', 'Ingénieur', 'Cisco, 5G, Python, DevOps');
  v_c5_stag := v_c5_id;

  INSERT INTO candidature (candidat_id, offre_id, statut, date_candidature, internship_start_date, internship_duration_months, internship_period_validated_at, mobile_access_prepared_at)
    VALUES (v_c5_id, v_offre_node, 'HUMAN_INTERVIEW_ACCEPTED', now() - INTERVAL '25 days', '2026-09-01', 3, now() - INTERVAL '18 days', now() - INTERVAL '5 days')
    RETURNING id INTO v_c5_cand;

  INSERT INTO ai_interview_sessions (candidature_id, token, statut, started_at, completed_at, evaluation_status, evaluation)
    VALUES (v_c5_cand, 'ia-token-oussama-demo', 'TERMINE', now() - INTERVAL '22 days', now() - INTERVAL '22 days' + INTERVAL '22 minutes', 'EVALUEE',
      '{"finalScore": 91, "recommendation": "Excellent candidat, entretien humain recommandé", "scores": {"technique": 94, "communication": 88, "motivation": 92}}');

  INSERT INTO human_interviews (candidature_id, date, heure, interviewer, lien_visio, statut, interviewer_email, completed_at, duree)
    VALUES (v_c5_cand, now() - INTERVAL '14 days', '14:00', 'Salma Bouazizi', 'https://teams.microsoft.com/l/meetup-join/demo-oussama', 'TERMINE', 'salma.bouazizi@steg.tn', now() - INTERVAL '14 days' + INTERVAL '45 minutes', 45);

  INSERT INTO candidature_decisions (candidature_id, decision, decided_by, decided_at, previous_status, new_status, action)
    VALUES (v_c5_cand, 'ACCEPTED', v_rh_salma, now() - INTERVAL '13 days', 'HUMAN_INTERVIEW_COMPLETED', 'HUMAN_INTERVIEW_ACCEPTED', 'RH_DECISION');

  -- ════════════════════════════════════════════════════════════
  -- STAGES ACTIFS avec projets, tâches, réunions, évaluations
  -- ════════════════════════════════════════════════════════════

  -- Stage 3 : Nesrine (déjà existant, on ajoute projet + tâches)
  v_stage1 := '22233f51-cc4b-4544-b13d-d15f4d38eb3e';

  -- Projet pour Nesrine (met à jour l'existant)
  UPDATE projet SET
    titre = 'Application Mobile STEG Internship',
    description = 'Développement d''une application mobile Flutter pour gérer le suivi des stagiaires, les tâches, les réunions et les documents.',
    technologies = 'Flutter, Dart, Riverpod, GoRouter, Node.js, PostgreSQL',
    etat = 'EN_COURS',
    avancement = 35
  WHERE stage_id = v_stage1
  RETURNING id INTO v_proj1;

  -- Tâches du projet Nesrine
  INSERT INTO tache (projet_id, createur_id, executant_id, titre, description, priorite, date_debut, date_fin, statut, progress, estimated_hours, spent_hours)
  VALUES
    (v_proj1, v_enc_ahmed, '5d08a337-2761-45dc-8b4b-438348173767', 'Setup Flutter project', 'Initialiser le projet Flutter avec la structure Clean Architecture', 'HAUTE', '2026-09-01', '2026-09-03', 'TERMINEE', 100, 16, 14),
    (v_proj1, v_enc_ahmed, '5d08a337-2761-45dc-8b4b-438348173767', 'Authentification JWT', 'Implémenter le login/register avec JWT et refresh tokens', 'HAUTE', '2026-09-04', '2026-09-10', 'EN_COURS', 70, 24, 18),
    (v_proj1, v_enc_ahmed, '5d08a337-2761-45dc-8b4b-438348173767', 'Dashboard Stagiaire', 'Créer l''écran d''accueil avec stats, tâches, réunions', 'MOYENNE', '2026-09-11', '2026-09-18', 'EN_COURS', 30, 20, 6),
    (v_proj1, v_enc_ahmed, '5d08a337-2761-45dc-8b4b-438348173767', 'Gestion des tâches', 'CRUD tâches avec filtres, statuts, priorités', 'MOYENNE', '2026-09-15', '2026-09-22', 'A_FAIRE', 0, 16, 0),
    (v_proj1, v_enc_ahmed, '5d08a337-2761-45dc-8b4b-438348173767', 'Push Notifications', 'Intégrer Firebase Cloud Messaging', 'BASSE', '2026-09-22', '2026-09-28', 'A_FAIRE', 0, 12, 0);

  -- Réunions pour Nesrine
  INSERT INTO reunion (stage_id, date, heure, salle, lien_visio, sujet)
  VALUES
    (v_stage1, CURRENT_DATE + 2, '09:00', 'Salle Réunion 3', 'https://teams.microsoft.com/l/meetup-join/demo-reunion1', 'Point hebdomadaire - Avancement Flutter'),
    (v_stage1, CURRENT_DATE + 9, '14:00', 'Salle Réunion 1', 'https://teams.microsoft.com/l/meetup-join/demo-reunion2', 'Revue de code et architecture');

  -- ──────────────────────────────────────────────────────────
  -- Stage 4 : Fatma Trabelsi (existe déjà, on enrichit)
  -- ──────────────────────────────────────────────────────────
  v_stage2 := 'c144d580-e39d-481b-9c01-2758cb2138ae';

  -- Réunions pour Fatma Trabelsi
  INSERT INTO reunion (stage_id, date, heure, salle, sujet)
  VALUES
    (v_stage2, CURRENT_DATE + 3, '11:00', 'Salle Informatique 2', 'Revue sprint - Dashboard Angular');

  -- Évaluation pour Fatma Trabelsi (déjà 1, ajoutons une 2e)
  INSERT INTO evaluation (stage_id, encadrant_id, technique, communication, autonomie, ponctualite, qualite, note_finale, commentaire)
    VALUES (v_stage2, v_enc_ahmed, 17, 16, 18, 15, 16, 16.40, 'Bonnes compétences techniques. Peut améliorer la communication en réunion.');

  -- ──────────────────────────────────────────────────────────
  -- Stage 5 : Mohamed Bouchnak (existe déjà, on enrichit)
  -- ──────────────────────────────────────────────────────────
  v_stage3 := '48629baa-cd0d-487c-9051-5c789b38b788';

  -- Réunions pour Mohamed
  INSERT INTO reunion (stage_id, date, heure, salle, sujet)
  VALUES
    (v_stage3, CURRENT_DATE + 4, '10:00', 'Salle Réseau', 'Point configuration switchs');

  -- ════════════════════════════════════════════════════════════
  -- NOTIFICATIONS ciblées pour la démo
  -- ════════════════════════════════════════════════════════════

  -- Notification pour Nesrine (nouvelle tâche)
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES ('5d08a337-2761-45dc-8b4b-438348173767', 'Nouvelle tâche assignée',
      'La tâche "Gestion des tâches" vous a été assignée par Ahmed Ben Salah.', 'TACHE', false);

  -- Notification pour Nesrine (réunion upcoming)
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES ('5d08a337-2761-45dc-8b4b-438348173767', 'Réunion planifiée',
      'Point hebdomadaire prévu le ' || to_char(CURRENT_DATE + 2, 'DD/MM/YYYY') || ' à 09:00.', 'REUNION', false);

  -- Notification pour encadrant (nouvelle candidature)
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES (v_enc_ahmed, 'Nouvelle candidature reçue', 'Inès Maalej a postulé pour Développeur Angular.', 'CANDIDATURE', false);

  -- Notification pour RH
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES (v_rh_salma, 'Candidat à évaluer', 'Ahmed Ben Khalifa a réussi l''entretien IA (78%). Entretien humain à planifier.', 'IA_RESULT', false);

  -- Notification pour Oussama (bienvenue stage)
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES (v_c5_id, 'Bienvenue en stage !', 'Votre candidature a été acceptée. Votre stage débutera le 01/09/2026.', 'STAGE', false);

  -- Notification non lue pour Fatma Trabelsi
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
    VALUES ('33a0fa59-cc0d-4c8e-9fe3-bc7fdaed7e6c', 'Évaluation disponible', 'Votre évaluation intermédiaire est disponible dans votre espace.', 'EVALUATION', false);

  -- Notification pour tous les stagiaires (info générale)
  INSERT INTO notification (utilisateur_id, titre, message, type, lue)
  SELECT id, 'Rappel : Rapport intermédiaire', 'N''oubliez pas de soumettre votre rapport intermédiaire avant le 30/09/2026.', 'INFO', true
  FROM utilisateur WHERE role = 'STAGIAIRE';

  RAISE NOTICE '✅ Données de démo insérées avec succès !';
  RAISE NOTICE '   5 candidats à divers étapes du pipeline';
  RAISE NOTICE '   2 réunions ajoutées pour Nesrine';
  RAISE NOTICE '   1 évaluation ajoutée pour Fatma Trabelsi';
  RAISE NOTICE '   6 notifications ciblées';

END $$;

COMMIT;
