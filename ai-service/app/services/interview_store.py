"""Stockage en mémoire des entretiens IA (moteur dynamique).

⚠️ STOCKAGE ÉPHÉMÈRE : les entretiens vivent en RAM et sont perdus au redémarrage
du service. C'est volontaire pour cette phase — le backend Node garde la source de
vérité (table ``ai_interviews``) et duplique questions / rapport localement.
Un vrai magasin persistant (PostgreSQL, Redis) remplacera ce module sans changer
les routes.
"""

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from .interview_engine import InterviewContext, QUESTION_COUNT, engine

_lock = threading.Lock()
_store: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create(candidature_id: str, offre: dict, cv: Optional[str] = None) -> dict:
    """Crée un entretien (statut CREATED). Un seul entretien actif par candidature."""
    with _lock:
        for session in _store.values():
            if (
                session["candidature_id"] == candidature_id
                and session["statut"] in ("CREATED", "STARTED")
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Un entretien IA est déjà en cours pour cette candidature.",
                )

        session_id = uuid.uuid4().hex
        entry = {
            "session_id": session_id,
            "candidature_id": candidature_id,
            "offre": offre or {},
            "cv": cv,
            "statut": "CREATED",
            "context": None,
            "questions": [],
            "expected_next": 1,
            "report": None,
            "created_at": _now(),
            "started_at": None,
            "completed_at": None,
        }
        _store[session_id] = entry
        return {"session_id": session_id, "statut": "CREATED", "created_at": entry["created_at"]}


def get(session_id: str) -> dict:
    with _lock:
        entry = _store.get(session_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entretien IA introuvable.")
        return {
            "session_id": entry["session_id"],
            "candidature_id": entry["candidature_id"],
            "statut": entry["statut"],
            "questions": entry["questions"],
            "expected_next": entry["expected_next"],
            "created_at": entry["created_at"],
            "started_at": entry["started_at"],
            "completed_at": entry["completed_at"],
        }


def start(session_id: str, offre: Optional[dict]) -> dict:
    """Démarre l'entretien : le moteur génère la première question."""
    with _lock:
        entry = _store.get(session_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entretien IA introuvable.")
        if entry["statut"] == "COMPLETED":
            raise HTTPException(status_code=409, detail="Cet entretien IA est déjà terminé.")
        if entry["statut"] == "STARTED":
            raise HTTPException(status_code=409, detail="Cet entretien IA est déjà démarré.")

        if offre and (offre.get("titre") or offre.get("technologies") or offre.get("competences")):
            entry["offre"] = offre

        context = InterviewContext(entry["offre"], entry["cv"])
        entry["context"] = context
        first = engine.start_interview(context)
        entry["questions"] = [first]
        entry["statut"] = "STARTED"
        entry["started_at"] = _now()
        entry["expected_next"] = 1
        return {
            "session_id": entry["session_id"],
            "statut": "STARTED",
            "question": first,
            "total_questions": QUESTION_COUNT,
        }


def answer(session_id: str, question_number: int, answer_text: str) -> dict:
    """Enregistre une réponse et renvoie la question suivante (ou ``done``)."""
    with _lock:
        entry = _store.get(session_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entretien IA introuvable.")
        if entry["statut"] == "COMPLETED":
            raise HTTPException(status_code=409, detail="Cet entretien IA est déjà terminé.")
        if entry["statut"] != "STARTED":
            raise HTTPException(
                status_code=409, detail="L'entretien doit être démarré avant de répondre."
            )
        if question_number != entry["expected_next"]:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Question hors séquence : attendez la question "
                    f"{entry['expected_next']}."
                ),
            )
        if not str(answer_text or "").strip():
            raise HTTPException(status_code=400, detail="La réponse ne peut pas être vide.")

        context = entry["context"]
        question = next(
            (q for q in context.question_history if q["question_number"] == question_number),
            None,
        )
        if question is None:
            raise HTTPException(status_code=404, detail="Question introuvable.")

        analysis = engine.analyze_answer(context, question, answer_text)
        context.answer_history.append(analysis)

        next_question = engine.generate_next_question(context, answer_text)
        if next_question is not None:
            entry["questions"].append(next_question)
            entry["expected_next"] += 1
            return {
                "session_id": entry["session_id"],
                "statut": "STARTED",
                "question_number": question_number,
                "next_question": next_question,
                "done": False,
            }

        entry["expected_next"] += 1
        return {
            "session_id": entry["session_id"],
            "statut": "STARTED",
            "question_number": question_number,
            "next_question": None,
            "done": True,
        }


def complete(session_id: str) -> dict:
    """Termine l'entretien : le moteur produit le rapport d'évaluation."""
    with _lock:
        entry = _store.get(session_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entretien IA introuvable.")
        if entry["statut"] == "COMPLETED":
            raise HTTPException(status_code=409, detail="Cet entretien IA est déjà terminé.")
        if entry["statut"] != "STARTED":
            raise HTTPException(
                status_code=409, detail="L'entretien doit être démarré avant d'être terminé."
            )

        context = entry["context"]
        if len(context.answer_history) < QUESTION_COUNT:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"L'entretien n'est pas terminé : {QUESTION_COUNT} questions attendues, "
                    f"{len(context.answer_history)} répondues."
                ),
            )

        entry["report"] = engine.finish_interview(context)
        entry["statut"] = "COMPLETED"
        entry["completed_at"] = _now()
        return {
            "session_id": entry["session_id"],
            "statut": "COMPLETED",
            "report": entry["report"],
        }


def report(session_id: str) -> dict:
    with _lock:
        entry = _store.get(session_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entretien IA introuvable.")
        if entry["statut"] != "COMPLETED":
            raise HTTPException(
                status_code=409, detail="Le rapport d'entretien n'est pas encore disponible."
            )
        return {
            "session_id": entry["session_id"],
            "candidature_id": entry["candidature_id"],
            "statut": "COMPLETED",
            "completed_at": entry["completed_at"],
            "report": entry["report"],
        }
