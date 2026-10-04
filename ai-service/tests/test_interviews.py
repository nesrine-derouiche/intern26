"""Tests des routes d'entretien IA vocal — flux dynamique (pont Node <-> Python)."""

import os
import uuid

os.environ["SERVICE_TOKEN"] = "test_token"
os.environ["PYTHON_SERVICE_PORT"] = "8001"

from app.config import get_settings

# Les autres fichiers de tests (test_health.py) peuvent avoir déjà importé l'app
# avec le jeton lu dans .env ; on purge le cache pour forcer la relecture de l'env.
get_settings.cache_clear()

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

AUTH = {"X-Service-Token": "test_token"}
OFFRE = {
    "titre": "Stage Développeur Web",
    "description": "Développement d'applications web internes.",
    "missions": "Développer des interfaces et participer aux tests.",
    "competences": ["Travail d'équipe", "Autonomie"],
    "niveau": "Bac+3 minimum",
    "technologies": ["JavaScript", "Angular", "Node.js"],
}


def _answers():
    return [
        "Je m'appelle Salma, étudiante en informatique, motivée par le web.",
        "Je suis passionnée et je veux rejoindre l'équipe pour apprendre.",
        "J'ai une licence en informatique et je poursuis en master.",
        "J'utilise Angular et Node.js dans mon projet de fin d'études.",
        "J'ai développé une application web complète en équipe.",
        "Je décompose le problème, je teste et je documente la solution.",
        "J'ai travaillé en équipe avec des réunions et du code review.",
        "La mission de développement m'attire, j'y contribuerai avec rigueur.",
    ]


def _create_session(candidature_id=None):
    res = client.post(
        "/api/v1/interviews",
        headers=AUTH,
        json={
            "candidature_id": candidature_id or uuid.uuid4().hex,
            "offre": OFFRE,
            "cv": "Licence en informatique, projet Angular.",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["session_id"]


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_interviews_require_service_token():
    assert client.post("/api/v1/interviews", json={"candidature_id": "x"}).status_code == 401
    assert (
        client.post(
            "/api/v1/interviews",
            headers={"X-Service-Token": "wrong"},
            json={"candidature_id": "x"},
        ).status_code
        == 401
    )


def test_entretien_conversationnel_complet():
    session_id = _create_session()

    res = client.get(f"/api/v1/interviews/{session_id}", headers=AUTH)
    assert res.status_code == 200
    assert res.json()["statut"] == "CREATED"
    assert res.json()["questions"] == []

    # Démarrage → première question (Présentation)
    res = client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    assert res.status_code == 200
    started = res.json()
    assert started["statut"] == "STARTED"
    assert started["total_questions"] == 8
    assert started["question"]["question_number"] == 1
    assert started["question"]["categorie"] == "PRESENTATION"

    # La réponse citant Angular doit générer une question technique adaptée
    res = client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=AUTH,
        json={"question_number": 1, "answer": "J'utilise Angular dans mes projets."},
    )
    assert res.status_code == 200
    step = res.json()
    assert step["done"] is False
    assert "Angular" in step["next_question"]["question"]

    # Terminer le reste de l'entretien (réponses 2 à 8)
    for qnum, answer in enumerate(_answers()[1:], start=2):
        res = client.post(
            f"/api/v1/interviews/{session_id}/answer",
            headers=AUTH,
            json={"question_number": qnum, "answer": answer},
        )
        assert res.status_code == 200, res.text
        step = res.json()
        if qnum == 8:
            assert step["done"] is True
            assert step["next_question"] is None
        else:
            assert step["done"] is False
            assert step["next_question"]["question_number"] == qnum + 1

    # Complétion → rapport
    res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=AUTH)
    assert res.status_code == 200
    completed = res.json()
    assert completed["statut"] == "COMPLETED"
    report = completed["report"]
    for key in (
        "score_global",
        "compatibilite_offre",
        "competences_techniques",
        "motivation",
        "communication",
        "points_forts",
        "points_faibles",
        "resume",
        "recommendation",
        "axes",
    ):
        assert key in report
    assert 0 <= report["score_global"] <= 100

    # Rapport disponible
    res = client.get(f"/api/v1/interviews/{session_id}/report", headers=AUTH)
    assert res.status_code == 200
    assert res.json()["report"]["score_global"] == report["score_global"]


def test_questions_uniques_dans_la_session():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    questions = []
    for qnum, answer in enumerate(_answers(), start=1):
        res = client.post(
            f"/api/v1/interviews/{session_id}/answer",
            headers=AUTH,
            json={"question_number": qnum, "answer": answer},
        )
        step = res.json()
        if qnum == 1:
            questions.append(step["next_question"]["question"])
        else:
            if step["next_question"]:
                questions.append(step["next_question"]["question"])

    seen = set(questions)
    assert len(questions) == len(seen)
    assert len(questions) == 7


def test_double_start_conflict():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    res = client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    assert res.status_code == 409


def test_question_hors_sequence_conflict():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    res = client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=AUTH,
        json={"question_number": 5, "answer": "réponse"},
    )
    assert res.status_code == 409


def test_reponse_vide_bad_request():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    res = client.post(
        f"/api/v1/interviews/{session_id}/answer",
        headers=AUTH,
        json={"question_number": 1, "answer": "   "},
    )
    assert res.status_code == 400


def test_complete_avant_la_fin_conflict():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=AUTH)
    assert res.status_code == 400


def test_complete_avant_start_conflict():
    session_id = _create_session()
    res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=AUTH)
    assert res.status_code == 409


def test_double_complete_conflict():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    for qnum, answer in enumerate(_answers(), start=1):
        client.post(
            f"/api/v1/interviews/{session_id}/answer",
            headers=AUTH,
            json={"question_number": qnum, "answer": answer},
        )
    assert client.post(f"/api/v1/interviews/{session_id}/complete", headers=AUTH).status_code == 200
    res = client.post(f"/api/v1/interviews/{session_id}/complete", headers=AUTH)
    assert res.status_code == 409


def test_report_before_complete_conflict():
    session_id = _create_session()
    client.post(f"/api/v1/interviews/{session_id}/start", headers=AUTH)
    res = client.get(f"/api/v1/interviews/{session_id}/report", headers=AUTH)
    assert res.status_code == 409


def test_unknown_session_404():
    assert client.get("/api/v1/interviews/does-not-exist", headers=AUTH).status_code == 404
    assert (
        client.post("/api/v1/interviews/does-not-exist/start", headers=AUTH).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/interviews/does-not-exist/answer",
            headers=AUTH,
            json={"question_number": 1, "answer": "x"},
        ).status_code
        == 404
    )
