"""Tests du moteur d'entretien IA dynamique (interview_engine.py).

Vérifie que les questions sont adaptées au candidat et à l'offre, qu'aucune
question n'est répétée, et que le rapport final est cohérent.
"""

import pytest

from app.services.interview_engine import (
    CATEGORIES,
    CATEGORIE_EXPERIENCE,
    CATEGORIE_PRESENTATION,
    CATEGORIE_TECHNIQUE,
    QUESTION_COUNT,
    InterviewContext,
    engine,
)

OFFRE = {
    "titre": "Stage Développeur Web",
    "description": "Développement d'applications web internes.",
    "missions": "Développer des interfaces, participer aux tests et à la mise en production.",
    "competences": ["Travail d'équipe", "Autonomie"],
    "niveau": "Bac+3 minimum",
    "technologies": ["JavaScript", "Angular", "Node.js"],
}


def _context(offre=None, cv=None):
    return InterviewContext(offre or OFFRE, cv)


def _simulate_full_interview(context, answers):
    """Joue l'entretien complet et renvoie les questions posées."""
    first = engine.start_interview(context)
    questions = [first]
    for answer in answers:
        analysis = engine.analyze_answer(context, questions[-1], answer)
        context.answer_history.append(analysis)
        next_question = engine.generate_next_question(context, answer)
        if next_question is None:
            break
        questions.append(next_question)
    return questions


class TestStartInterview:
    def test_start_renvoie_la_presentation(self):
        context = _context()
        question = engine.start_interview(context)

        assert question["question_number"] == 1
        assert question["categorie"] == CATEGORIE_PRESENTATION
        assert question["question"] == "Présentez-vous brièvement."
        assert len(context.question_history) == 1

    def test_start_reinitialise_le_contexte(self):
        context = _context()
        questions = _simulate_full_interview(context, ["a"] * QUESTION_COUNT)
        assert len(questions) == QUESTION_COUNT

        engine.start_interview(context)
        assert context.answer_history == []
        assert len(context.question_history) == 1
        assert context.used_categories == {CATEGORIE_PRESENTATION}


class TestGenerateNextQuestion:
    def test_premiere_suivante_est_la_motivation(self):
        context = _context()
        engine.start_interview(context)
        next_q = engine.generate_next_question(context, "Je suis motivé par ce domaine.")

        assert next_q["question_number"] == 2
        assert next_q["categorie"] == "MOTIVATION"
        assert "Stage Développeur Web" in next_q["question"]

    def test_technologie_citee_declenche_une_question_sur_cette_technologie(self):
        context = _context()
        engine.start_interview(context)
        next_q = engine.generate_next_question(
            context, "Je travaille avec Angular sur mes projets."
        )

        assert next_q["categorie"] == CATEGORIE_TECHNIQUE
        assert "Angular" in next_q["question"]
        assert "projet" in next_q["question"]

    def test_projet_cite_declenche_une_question_sur_les_experiences(self):
        context = _context()
        engine.start_interview(context)
        next_q = engine.generate_next_question(
            context, "J'ai réalisé un projet de fin d'études."
        )

        assert next_q["categorie"] == CATEGORIE_EXPERIENCE
        assert "projet" in next_q["question"]

    def test_les_8_questions_sont_uniques_et_couvrent_8_categories(self):
        context = _context()
        questions = _simulate_full_interview(
            context,
            [
                "Je suis motivé et passionné par le développement.",
                "J'ai une licence en informatique.",
                "J'utilise Angular et Node.js au quotidien.",
                "J'ai fait un stage sur une application web.",
                "Je décompose le problème et je teste la solution.",
                "J'ai travaillé en équipe en utilisant la méthode agile.",
                "La mission de développement m'attire particulièrement.",
            ],
        )

        assert len(questions) == QUESTION_COUNT
        categories = [q["categorie"] for q in questions]
        assert len(set(categories)) == QUESTION_COUNT
        assert len(set(q["question"] for q in questions)) == QUESTION_COUNT

    def test_pas_de_question_apres_la_8eme(self):
        context = _context()
        questions = _simulate_full_interview(context, ["réponse"] * 8)
        assert len(questions) == QUESTION_COUNT
        assert engine.generate_next_question(context, "encore") is None

    def test_question_sur_les_missions_de_loffre(self):
        context = _context()
        questions = _simulate_full_interview(
            context,
            [
                "Je suis motivé par le développement web.",
                "J'ai une licence en informatique.",
                "J'utilise JavaScript.",
                "J'ai un projet académique.",
                "Je résous les problèmes par étapes.",
                "J'aime travailler en équipe.",
                "Le développement d'interfaces m'intéresse.",
            ],
        )
        offer_question = [q for q in questions if q["categorie"] == "OFFRE_SPECIFIQUE"][0]
        assert "missions" in offer_question["question"] or "prévoit" in offer_question["question"]


class TestAnalyzeAnswer:
    def test_analyse_detecte_technologies_et_longueur(self):
        context = _context()
        question = engine.start_interview(context)
        analysis = engine.analyze_answer(
            context, question, "Je m'appelle Salma, je suis étudiante en informatique."
        )

        assert analysis["categorie"] == CATEGORIE_PRESENTATION
        assert analysis["word_count"] >= 6
        assert 0 <= analysis["quality"] <= 100

    def test_analyse_repere_une_technologie_de_loffre(self):
        context = _context()
        question = {"question_number": 5, "categorie": CATEGORIE_TECHNIQUE, "question": "?"}
        analysis = engine.analyze_answer(context, question, "Je maîtrise Angular." )

        assert "Angular" in analysis["technologies_found"]


class TestFinishInterview:
    def test_rapport_coherent_apres_entretien_complet(self):
        context = _context()
        answers = [
            "Je m'appelle Karim, étudiant ingénieur, motivé par le web.",
            "Je suis passionné et je veux apprendre en rejoignant l'équipe.",
            "J'ai une licence en informatique et je suis en master.",
            "J'utilise Angular et Node.js dans mon projet de fin d'études.",
            "J'ai développé une application web complète en équipe.",
            "Je décompose le problème, je teste et je documente la solution.",
            "J'ai travaillé en équipe avec des réunions et du code review.",
            "La mission de développement m'attire et j'y contribuerai avec rigueur.",
        ]
        questions = _simulate_full_interview(context, answers)

        report = engine.finish_interview(context)

        assert 0 <= report["score_global"] <= 100
        assert report["recommendation"] in ("FAVORABLE", "A_REVOIR", "DEFAVORABLE")
        for axis in (
            "presentation",
            "motivation",
            "formation",
            "technical",
            "experience",
            "problem_solving",
            "teamwork",
            "offer_specific",
        ):
            assert 0 <= report["axes"][axis] <= 100
        for key in (
            "compatibilite_offre",
            "competences_techniques",
            "motivation",
            "communication",
        ):
            assert 0 <= report[key] <= 100
        assert isinstance(report["points_forts"], list)
        assert isinstance(report["points_faibles"], list)
        assert isinstance(report["resume"], str) and report["resume"]
        assert len(report["analyses"]) == QUESTION_COUNT

    def test_rapport_defavorable_pour_reponses_lacunaires(self):
        context = _context()
        answers = [
            "Oui.",
            "Peut-être.",
            "Bof.",
            "Pas sûr.",
            "Aucune idée.",
            "Non.",
            "On verra.",
            "Peut-être plus tard.",
        ]
        questions = _simulate_full_interview(context, answers)

        report = engine.finish_interview(context)
        assert report["score_global"] < 50
        assert report["recommendation"] == "DEFAVORABLE"

    def test_rapport_impossible_sans_reponses(self):
        context = _context()
        engine.start_interview(context)
        report = engine.finish_interview(context)
        assert report["score_global"] == 0
        assert report["recommendation"] == "DEFAVORABLE"
