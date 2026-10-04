"""Tests de la vérification de documents d'onboarding.

Les documents de test sont générés en mémoire (DOCX via python-docx, PDF via
pypdf) : aucun fichier externe requis, aucun appel réseau.
"""

import io
import os

import pytest

os.environ["SERVICE_TOKEN"] = "test_token"
os.environ["DOCUMENT_OCR_REQUIRED"] = "0"

from app.config import get_settings

get_settings.cache_clear()

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.documents import CandidateInfo
from app.services import document_verification as dv_module
from app.services.document_verification import (
    DocumentUnavailableError,
    DocumentValidationError,
    build_document_verification_service,
)

client = TestClient(app)

AUTH = {"X-Service-Token": "test_token"}

SALMA = '{"nom": "Ben Ali", "prenom": "Salma", "email": "salma@example.tn", "cin": "01234567"}'

VALID_CV_PARAGRAPHS = [
    "Salma Ben Ali",
    "Curriculum Vitae",
    "Formation : Master en informatique, Université de Tunis.",
    "Expérience : stage de 6 mois, projet de fin d'études en Python.",
]


# ─────────────────────────── Génération de documents ─────────────────────────


def _make_docx(*paragraphs: str) -> bytes:
    """Génère un DOCX valide en mémoire contenant les paragraphes donnés."""
    import docx

    document = docx.Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _make_pdf_with_text(text: str) -> bytes:
    """Génère un PDF valide en mémoire contenant le texte donné."""
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, StreamObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = writer._add_object(
        DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
    )
    resources = writer._add_object(
        DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
    )
    content = StreamObject()
    content.set_data(f"BT /F1 12 Tf 72 700 Td ({text}) Tj ET".encode("utf-8"))
    content_ref = writer._add_object(content)
    page[NameObject("/Resources")] = resources
    page[NameObject("/Contents")] = content_ref

    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def _make_blank_pdf() -> bytes:
    """Génère un PDF valide mais SANS texte extractible (page vierge)."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def _verify(content: bytes, filename: str, doc_type: str, candidate: str = SALMA):
    files = {"file": (filename, content, "application/octet-stream")}
    data = {
        "document_type": doc_type,
        "candidature_id": "00000000-0000-0000-0000-000000000001",
        "candidate": candidate,
    }
    return client.post("/api/documents/verify", files=files, data=data, headers=AUTH)


# ─────────────────────────── Scénarios requis ────────────────────────────────


def test_document_valide_est_accepte():
    """Un CV cohérent avec le dossier du candidat est VALID."""
    response = _verify(_make_docx(*VALID_CV_PARAGRAPHS), "cv-salma.docx", "CV")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "VALID"
    assert payload["confidence"] >= 85
    assert payload["checks"]["document_type_match"] is True
    assert payload["checks"]["candidate_name_match"] is True
    assert payload["checks"]["required_information_present"] is True
    assert payload["issues"] == []
    assert "cohérent" in payload["summary"]


def test_mauvais_type_de_document_est_rejete():
    """Un CV soumis comme CIN est REJECTED (type détecté différent)."""
    response = _verify(_make_docx(*VALID_CV_PARAGRAPHS), "cv-salma.docx", "CIN")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "REJECTED"
    assert payload["checks"]["document_type_match"] is False
    assert payload["confidence"] <= 25
    assert any("curriculum" in issue or "carte nationale" in issue for issue in payload["issues"])


def test_document_illisible_est_rejete():
    """Un PDF sans texte extractible est REJECTED (impossible à vérifier)."""
    response = _verify(_make_blank_pdf(), "cv-salma.pdf", "CV")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "REJECTED"
    assert payload["confidence"] <= 10
    assert any("texte" in issue.lower() for issue in payload["issues"])


def test_informations_requises_manquantes_imposent_la_verification():
    """Un CV sans parcours de formation / expérience est REVIEW_REQUIRED."""
    docx = _make_docx("Salma Ben Ali", "Curriculum Vitae", "Je vous remercie de votre attention.")
    response = _verify(docx, "cv-salma.docx", "CV")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "REVIEW_REQUIRED"
    assert payload["checks"]["required_information_present"] is False
    assert payload["confidence"] <= 84
    assert any("manquantes" in issue for issue in payload["issues"])


def test_incoherence_avec_les_informations_du_candidat_est_rejetee():
    """Un CV d'une autre personne que le candidat est REJECTED."""
    docx = _make_docx(
        "Karim Trabelsi",
        "Curriculum Vitae",
        "Formation : Licence en informatique.",
        "Expérience : stage dans une société.",
    )
    response = _verify(docx, "cv-karim.docx", "CV")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "REJECTED"
    assert payload["checks"]["candidate_name_match"] is False
    assert any("nom" in issue.lower() for issue in payload["issues"])


def test_fichier_contrefait_est_rejete():
    """Des octets invalides avec une extension valide sont REJECTED (illisible)."""
    response = _verify(b"ceci n'est pas un pdf", "cv-salma.pdf", "CV")

    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"


def test_format_non_pris_en_charge_est_refuse():
    """Une extension inconnue est refusée en 400 (comme le backend Node)."""
    response = _verify(b"hello", "cv-salma.xyz", "CV")

    assert response.status_code == 400
    assert "Format non pris en charge" in response.json()["detail"]


def test_service_indisponible_renvoie_503(monkeypatch):
    """Un service de vérification indisponible répond 503."""

    class UnavailableService:
        def verify_document(self, *args, **kwargs):
            raise DocumentUnavailableError("Service de vérification indisponible.")

    monkeypatch.setattr(
        "app.services.document_verification.document_verification_service",
        UnavailableService(),
    )

    response = _verify(_make_docx(*VALID_CV_PARAGRAPHS), "cv-salma.docx", "CV")
    assert response.status_code == 503


def test_reponse_json_structuree():
    """La réponse respecte le contrat JSON structuré (tous les champs)."""
    response = _verify(_make_docx(*VALID_CV_PARAGRAPHS), "cv-salma.docx", "CV")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"status", "confidence", "document_type", "checks", "issues", "summary"}
    assert payload["status"] in ("VALID", "REVIEW_REQUIRED", "REJECTED")
    assert 0 <= payload["confidence"] <= 100
    assert payload["document_type"] == "CV"
    assert set(payload["checks"].keys()) == {
        "document_type_match",
        "candidate_name_match",
        "required_information_present",
    }
    assert all(isinstance(issue, str) for issue in payload["issues"])
    assert isinstance(payload["summary"], str) and payload["summary"]


# ───────────────────────────── Sécurité / contrats ───────────────────────────


def test_aucune_donnee_personnelle_dans_la_reponse():
    """Ni le numéro CIN ni le nom ne doivent apparaître dans la réponse."""
    response = _verify(
        _make_docx("Salma Ben Ali", "Carte nationale d'identité", "Numéro : 01234567"),
        "cin-salma.pdf",
        "CIN",
    )

    assert response.status_code == 200
    body = response.text
    assert "01234567" not in body
    assert "Ben Ali" not in body


def test_authentification_obligatoire():
    """Sans jeton de service, la route refuse en 401."""
    files = {"file": ("cv-salma.docx", _make_docx(*VALID_CV_PARAGRAPHS), "application/octet-stream")}
    response = client.post(
        "/api/documents/verify",
        files=files,
        data={"document_type": "CV", "candidate": SALMA},
    )
    assert response.status_code == 401


def test_candidat_invalide_est_refuse():
    """Un champ « candidate » non-JSON est refusé en 400."""
    response = _verify(_make_docx(*VALID_CV_PARAGRAPHS), "cv-salma.docx", "CV", candidate="pas-du-json")
    assert response.status_code == 400


def test_fichier_vide_est_refuse():
    """Un fichier vide est refusé en 400."""
    response = _verify(b"", "cv-salma.docx", "CV")
    assert response.status_code == 400
    assert "vide" in response.json()["detail"]


# ──────────────────────── Autres types de documents ──────────────────────────


def test_demande_de_stage_valide():
    """Une demande de stage cohérente est VALID."""
    docx = _make_docx(
        "Objet : Demande de stage",
        "Madame, Monsieur,",
        "Je soussignée Salma Ben Ali souhaite effectuer une demande de stage.",
    )
    response = _verify(docx, "demande-stage-salma.docx", "DEMANDE_STAGE")

    assert response.status_code == 200
    assert response.json()["status"] == "VALID"


def test_lettre_d_affectation_valide():
    """Une lettre d'affectation cohérente est VALID."""
    docx = _make_docx(
        "Lettre d'affectation",
        "Affectation de Salma Ben Ali en qualité de stagiaire à la STEG.",
        "Direction des ressources humaines.",
    )
    response = _verify(docx, "lettre-affectation-salma.docx", "LETTRE_AFFECTATION")

    assert response.status_code == 200
    assert response.json()["status"] == "VALID"


def test_cin_valide_avec_numero_correspondant():
    """Une carte d'identité dont le numéro correspond au dossier est VALID."""
    docx = _make_docx(
        "Carte nationale d'identité",
        "Nom : Salma Ben Ali",
        "Numéro : 01234567",
    )
    response = _verify(docx, "cin-salma.docx", "CIN")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "VALID"
    assert payload["checks"]["required_information_present"] is True


def test_cin_avec_numero_incoherent_impose_la_verification():
    """Un numéro de carte différent du dossier est REVIEW_REQUIRED."""
    docx = _make_docx(
        "Carte nationale d'identité",
        "Nom : Salma Ben Ali",
        "Numéro : 11112222",
    )
    response = _verify(docx, "cin-salma.docx", "CIN")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "REVIEW_REQUIRED"
    assert any("numéro" in issue.lower() for issue in payload["issues"])


def test_pdf_avec_texte_est_lu_et_valide():
    """L'extraction de texte d'un vrai PDF fonctionne (pypdf)."""
    pdf = _make_pdf_with_text(
        "Salma Ben Ali - Curriculum Vitae. Formation : Licence en informatique. "
        "Expérience : projet de fin d'études."
    )
    response = _verify(pdf, "cv-salma.pdf", "CV")

    assert response.status_code == 200
    assert response.json()["status"] == "VALID"


def test_nom_partiellement_retrouve_impose_la_verification():
    """Un CV où seul le prénom apparaît est REVIEW_REQUIRED."""
    docx = _make_docx(
        "Salma",
        "Curriculum Vitae",
        "Formation : Master en informatique.",
        "Expérience : stage de 3 mois.",
    )
    response = _verify(docx, "cv-salma.docx", "CV")

    assert response.status_code == 200
    assert response.json()["status"] == "REVIEW_REQUIRED"


# ───────────────────────────── Tests unitaires ───────────────────────────────


def test_build_ocr_requis_sans_tesseract_leve_une_erreur(monkeypatch):
    """OCR requis mais indisponible => erreur 503 (au montage du service)."""

    class FakeSettings:
        document_max_bytes = 10 * 1024 * 1024
        document_ocr_required = True

    monkeypatch.setattr("app.services.document_verification._ocr_available", lambda: False)

    with pytest.raises(DocumentUnavailableError):
        build_document_verification_service(settings=FakeSettings())


def test_fichier_trop_volumineux_est_refuse():
    """La limite de taille est appliquée par le service."""

    class FakeSettings:
        document_max_bytes = 128
        document_ocr_required = False

    service = build_document_verification_service(settings=FakeSettings())

    with pytest.raises(DocumentValidationError) as exc:
        service.verify_document(b"x" * 1024, "cv-salma.pdf", "CV", CandidateInfo())
    assert "volumineux" in str(exc.value)


def test_type_de_document_inconnu_est_refuse():
    """Un type de document hors contrat est refusé (400)."""
    service = build_document_verification_service()
    with pytest.raises(DocumentValidationError):
        service.verify_document(_make_docx("a"), "doc.txt", "PASSEPORT", CandidateInfo())
