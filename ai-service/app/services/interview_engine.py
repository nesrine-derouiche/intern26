"""MOTEUR D'ENTRETIEN IA — conversationnel et dynamique.

Contrairement à une liste fixe de questions, ce moteur construit l'entretien
pas à pas : chaque nouvelle question est générée à partir du contexte (offre,
CV, historique des questions et des réponses) et des mots-clés détectés dans
la réponse précédente du candidat.

Le moteur est DÉTERMINISTE et testable : le même contexte produit toujours la
même question. Il couvre 8 catégories, sans jamais répéter une question.

Fonctions publiques :
  - start_interview(context)        → première question (Présentation)
  - generate_first_question(context)→ première question
  - generate_next_question(context, previous_answer) → question suivante (ou None)
  - analyze_answer(context, question, answer) → analyse détaillée de la réponse
  - finish_interview(context)       → rapport d'évaluation final
"""

import re

QUESTION_COUNT = 8

CATEGORIE_PRESENTATION = "PRESENTATION"
CATEGORIE_MOTIVATION = "MOTIVATION"
CATEGORIE_FORMATION = "FORMATION"
CATEGORIE_TECHNIQUE = "COMPETENCES_TECHNIQUES"
CATEGORIE_EXPERIENCE = "EXPERIENCES_PROJETS"
CATEGORIE_RESOLUTION = "RESOLUTION_PROBLEMES"
CATEGORIE_EQUIPE = "TRAVAIL_EQUIPE"
CATEGORIE_OFFRE = "OFFRE_SPECIFIQUE"

# Toutes les catégories possibles (une question par catégorie maximum).
CATEGORIES = [
    CATEGORIE_PRESENTATION,
    CATEGORIE_MOTIVATION,
    CATEGORIE_FORMATION,
    CATEGORIE_TECHNIQUE,
    CATEGORIE_EXPERIENCE,
    CATEGORIE_RESOLUTION,
    CATEGORIE_EQUIPE,
    CATEGORIE_OFFRE,
]

# Ordre d'appel par défaut après la présentation (adapté dynamiquement).
_PLAN_ORDER = [
    CATEGORIE_MOTIVATION,
    CATEGORIE_FORMATION,
    CATEGORIE_TECHNIQUE,
    CATEGORIE_EXPERIENCE,
    CATEGORIE_RESOLUTION,
    CATEGORIE_EQUIPE,
    CATEGORIE_OFFRE,
]

# Poids des axes dans le score global (somme = 1.0).
_AXIS_WEIGHTS = {
    CATEGORIE_PRESENTATION: 0.05,
    CATEGORIE_MOTIVATION: 0.15,
    CATEGORIE_FORMATION: 0.10,
    CATEGORIE_TECHNIQUE: 0.25,
    CATEGORIE_EXPERIENCE: 0.20,
    CATEGORIE_RESOLUTION: 0.15,
    CATEGORIE_EQUIPE: 0.05,
    CATEGORIE_OFFRE: 0.05,
}

MOTIVATION_KEYWORDS = [
    "motiv", "passion", "intéress", "envie", "ambition", "découvrir", "apprendre",
    "rejoindre", "contribution", "objectif", "développ", "expérience", "carrière",
    "renforcer", "savoir",
]
PROJECT_KEYWORDS = [
    "projet", "stage", "réalis", "développé", "conçu", "contexte", "github",
    "application", "site", "module", "pfe", "portfolio", "thèse", "travail de fin",
]
PROBLEM_KEYWORDS = [
    "problème", "problèmes", "solution", "solutions", "analys", "étape", "étapes",
    "test", "tests", "débog", "résoud", "résolution", "méthode", "plan", "corrigé",
    "contournement", "documenter", "erreur", "recherche", "diagnostique",
]
TEAMWORK_KEYWORDS = [
    "équipe", "equipe", "collaboration", "communiquer", "communication", "collectif",
    "réunion", "sprint", "scrum", "agile", "binôme", "binome", "coéquipier", "groupe",
]
FORMATION_KEYWORDS = [
    "formation", "licence", "master", "ingénieur", "ingénieure", "diplôme", "université",
    "école", "pfe", "module", "cours", "spécialité", "spécialité", "bac", "dut", "btp",
    "génie", "informatique", "gestion", "finance", "mécanique", "électrique",
]

_SPLIT_CHARS = ",;\n"
# Limite de mot : caractère alphanumérique (accents compris) ou trait d'union.
_WORD_BOUNDARY = r"(?:^|[^a-zà-ÿ0-9]){}(?:[^a-zà-ÿ0-9]|$)"


class InterviewContext:
    """Contexte conservé pendant tout l'entretien.

    - offre : dictionnaire envoyé par le backend (titre, description, missions,
      competences, niveau, technologies, departement, duree, ...) ;
    - cv : texte libre du CV du candidat s'il est disponible (sinon None) ;
    - question_history : questions déjà posées ;
    - answer_history : réponses analysées (sortie d'analyze_answer).
    """

    def __init__(self, offre=None, cv=None):
        self.offre = offre or {}
        self.cv = cv
        self.question_history = []
        self.answer_history = []
        self.used_categories = set()
        self.used_technologies = set()


# ─────────────────────────────── Outils texte ───────────────────────────────


def _to_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(_SPLIT_CHARS) if item.strip()]


def _norm(value):
    return str(value or "").strip().lower()


def _word_count(text):
    return len(str(text or "").split())


def _contains(text, keyword):
    """Vrai si le mot-clé apparaît en tant que mot entier (insensible à la casse)."""
    pattern = _WORD_BOUNDARY.format(re.escape(_norm(keyword)))
    return bool(re.search(pattern, _norm(text)))


def _extract_keyword(text, keywords):
    for keyword in keywords:
        if keyword and _contains(text, keyword):
            return keyword
    return None


def _extract_first_tech(text, offre):
    """Première technologie/compétence de l'offre citée dans le texte."""
    techs = _to_list(offre.get("technologies")) + _to_list(offre.get("competences"))
    for tech in techs:
        if tech and _contains(text, tech):
            return tech
    return None


def _shorten(text, limit=120):
    value = str(text or "").strip()
    if not value:
        return None
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


# ─────────────────────────────────── Moteur ─────────────────────────────────


class InterviewEngine:
    """Génère les questions, analyse les réponses et finalise l'évaluation."""

    # ── Cycle de vie ──────────────────────────────────────────────────────────

    def start_interview(self, context):
        """Réinitialise le contexte et renvoie la première question."""
        context.question_history = []
        context.answer_history = []
        context.used_categories = set()
        context.used_technologies = set()
        return self.generate_first_question(context)

    def generate_first_question(self, context):
        """Première question : présentation du candidat."""
        return self._ask(
            context,
            {
                "question_number": 1,
                "categorie": CATEGORIE_PRESENTATION,
                "question": "Présentez-vous brièvement.",
            },
        )

    def generate_next_question(self, context, previous_answer):
        """Génère la question suivante à partir de la réponse précédente.

        Renvoie ``None`` quand les 8 questions ont été posées.
        """
        if len(context.question_history) >= QUESTION_COUNT:
            return None

        categorie = self._choose_next_category(context, previous_answer)
        question = self._build_for_category(context, categorie, previous_answer)
        return self._ask(
            context,
            {
                "question_number": len(context.question_history) + 1,
                "categorie": categorie,
                "question": question,
            },
        )

    def analyze_answer(self, context, question, answer):
        """Analyse une réponse : longueur, mots-clés, technologies, qualité 0..100."""
        text = str(answer or "").strip()
        categorie = question.get("categorie")
        keywords = self._keywords_for(context, categorie)

        word_count = _word_count(text)
        kw_hits = sum(1 for kw in keywords if kw and _contains(text, kw))
        techs_found = [
            tech
            for tech in _to_list(context.offre.get("technologies"))
            + _to_list(context.offre.get("competences"))
            if tech and _contains(text, tech)
        ]

        length_score = min(1.0, word_count / 40.0)
        keyword_score = min(1.0, kw_hits / 3.0)
        tech_bonus = (
            min(1.0, len(techs_found)) * 0.1
            if categorie in (CATEGORIE_TECHNIQUE, CATEGORIE_EXPERIENCE, CATEGORIE_OFFRE)
            else 0.0
        )
        quality = max(0, min(100, round(100 * (0.5 * length_score + 0.4 * keyword_score + tech_bonus))))

        return {
            "question_number": question.get("question_number"),
            "categorie": categorie,
            "answer": text,
            "word_count": word_count,
            "keywords_found": kw_hits,
            "technologies_found": techs_found,
            "quality": quality,
        }

    def finish_interview(self, context):
        """Produit l'analyse finale structurée de l'entretien.

        Le rapport suit le contrat attendu par le backend (sauvegardé dans
        ``ai_interviews.evaluation``) et affiché dans le dashboard RH :

            score_global, compatibilite_offre, competences_techniques,
            motivation, communication, points_forts, points_faibles,
            resume, recommendation (FAVORABLE | A_REVOIR | DEFAVORABLE),
            axes (sous-scores par catégorie), analyses (par réponse).

        ⚠️ La recommandation est INFORMATIVE : elle ne déclenche JAMAIS
        automatiquement l'acceptation du candidat. La décision finale
        d'acceptation reste une décision humaine du service RH.
        """
        axes = {}
        for categorie in CATEGORIES:
            values = [a["quality"] for a in context.answer_history if a["categorie"] == categorie]
            axes[self._axis_key(categorie)] = round(sum(values) / len(values)) if values else 0

        # Communication : qualité de l'expression, déduite de la longueur des réponses.
        if context.answer_history:
            avg_words = sum(a["word_count"] for a in context.answer_history) / len(
                context.answer_history
            )
            axes["communication"] = max(0, min(100, round(100 * min(1.0, avg_words / 30.0))))
        else:
            axes["communication"] = 0

        score_global = round(
            sum(axes[self._axis_key(cat)] * weight for cat, weight in _AXIS_WEIGHTS.items())
        )

        # Compatibilité CV / réponses avec l'offre de stage.
        compatibilite_offre = round(
            0.40 * axes["technical"]
            + 0.25 * axes["experience"]
            + 0.20 * axes["offer_specific"]
            + 0.15 * axes["formation"]
        )
        competences_techniques = axes["technical"]
        motivation = axes["motivation"]
        communication = axes["communication"]

        points_forts = []
        points_faibles = []

        if motivation >= 60:
            points_forts.append("Bonne motivation et intérêt pour le stage")
        if competences_techniques >= 60:
            points_forts.append("Bonnes compétences techniques en lien avec l'offre")
        if axes["experience"] >= 60:
            points_forts.append("Expériences et projets cohérents avec l'offre")
        if compatibilite_offre >= 60:
            points_forts.append("Bonne adéquation du profil avec l'offre de stage")
        if communication >= 60:
            points_forts.append("Bonne expression et clarté des réponses")
        if not points_forts:
            points_forts.append("Profil à confirmer lors de l'entretien humain")

        if motivation < 50:
            points_faibles.append("Motivation à renforcer")
        if competences_techniques < 50:
            points_faibles.append("Compétences techniques à approfondir")
        if axes["experience"] < 50:
            points_faibles.append("Expériences et projets à valoriser davantage")
        if axes["problem_solving"] < 50:
            points_faibles.append("Approche de résolution de problèmes à structurer")
        if communication < 50:
            points_faibles.append("Expression des réponses à travailler")
        if len(context.answer_history) < QUESTION_COUNT:
            points_faibles.append("Toutes les questions n'ont pas été répondues")

        if score_global >= 60 and not points_faibles:
            points_faibles.append("Aucune faiblesse majeure détectée")

        return {
            "score_global": score_global,
            "compatibilite_offre": compatibilite_offre,
            "competences_techniques": competences_techniques,
            "motivation": motivation,
            "communication": communication,
            "points_forts": points_forts,
            "points_faibles": points_faibles,
            "resume": self._build_resume(context, axes, score_global, compatibilite_offre),
            "recommendation": self._recommendation(score_global),
            "axes": axes,
            "analyses": context.answer_history,
        }

    def _recommendation(self, score_global):
        """Recommandation indicative (jamais une décision automatique)."""
        if score_global >= 70:
            return "FAVORABLE"
        if score_global >= 50:
            return "A_REVOIR"
        return "DEFAVORABLE"

    def _build_resume(self, context, axes, score_global, compatibilite_offre):
        """Résumé déterministe de l'entretien pour le dashboard RH."""
        titre = str(context.offre.get("titre") or "l'offre").strip()

        if not context.answer_history:
            return "Entretien terminé sans réponse exploitable : aucune évaluation possible."

        if score_global >= 70:
            phrases = [f"Bilan global positif ({score_global}/100) pour le stage « {titre} »."]
        elif score_global >= 50:
            phrases = [
                f"Bilan global mitigé ({score_global}/100) pour le stage « {titre} » : "
                "quelques axes restent à confirmer."
            ]
        else:
            phrases = [
                f"Bilan global insuffisant ({score_global}/100) pour le stage « {titre} »."
            ]

        if compatibilite_offre >= 70:
            phrases.append(
                f"Bonne compatibilité avec l'offre ({compatibilite_offre}/100), en particulier "
                "sur les compétences techniques et les expériences."
            )
        elif compatibilite_offre >= 45:
            phrases.append(
                f"Compatibilité moyenne avec l'offre ({compatibilite_offre}/100) : des écarts "
                "subsistent sur certaines exigences."
            )
        else:
            phrases.append(
                f"Compatibilité faible avec l'offre ({compatibilite_offre}/100) : le profil "
                "couvre difficilement les exigences du poste."
            )

        if axes["motivation"] >= 60:
            phrases.append("La motivation et l'intérêt pour le stage sont clairement exprimés.")
        elif axes["motivation"] < 45:
            phrases.append("La motivation est peu démontrée dans les réponses.")

        if axes["communication"] >= 60:
            phrases.append("Les réponses sont claires et structurées.")
        elif axes["communication"] < 45:
            phrases.append(
                "Les réponses sont courtes et peu développées ; l'expression est à travailler."
            )

        phrases.append(
            f"Recommandation indicative : {self._recommendation(score_global)} "
            "(la décision finale reste une décision humaine du service RH)."
        )
        return " ".join(phrases)

    # ── Choix et construction des questions ──────────────────────────────────

    def _choose_next_category(self, context, previous_answer):
        """Choisit la catégorie de la question suivante selon la réponse donnée."""
        # Le candidat a cité une technologie de l'offre → approfondir immédiatement.
        if (
            CATEGORIE_TECHNIQUE not in context.used_categories
            and _extract_first_tech(previous_answer, context.offre)
        ):
            return CATEGORIE_TECHNIQUE

        # Le candidat a évoqué un projet → approfondir ses expériences.
        if (
            CATEGORIE_EXPERIENCE not in context.used_categories
            and _extract_keyword(previous_answer, PROJECT_KEYWORDS)
        ):
            return CATEGORIE_EXPERIENCE

        for categorie in _PLAN_ORDER:
            if categorie not in context.used_categories:
                return categorie
        return None

    def _build_for_category(self, context, categorie, previous_answer):
        if categorie == CATEGORIE_MOTIVATION:
            return self._build_motivation(context, previous_answer)
        if categorie == CATEGORIE_FORMATION:
            return self._build_formation(context, previous_answer)
        if categorie == CATEGORIE_TECHNIQUE:
            return self._build_technical(context, previous_answer)
        if categorie == CATEGORIE_EXPERIENCE:
            return self._build_experience(context, previous_answer)
        if categorie == CATEGORIE_RESOLUTION:
            return self._build_problem(context, previous_answer)
        if categorie == CATEGORIE_EQUIPE:
            return self._build_teamwork(context, previous_answer)
        if categorie == CATEGORIE_OFFRE:
            return self._build_offer_specific(context, previous_answer)
        return "Pouvez-vous développer votre réponse précédente ?"

    def _build_motivation(self, context, previous_answer):
        titre = context.offre.get("titre") or "ce stage"
        motif = _extract_keyword(previous_answer, MOTIVATION_KEYWORDS)
        if motif:
            return (
                f"Vous avez évoqué « {motif} ». Pourquoi souhaitez-vous effectuer "
                f"le stage « {titre} » ?"
            )
        return f"Pourquoi souhaitez-vous effectuer le stage « {titre} » ?"

    def _build_formation(self, context, previous_answer):
        mention = self._cv_field(context, ("formation", "diplome")) or _extract_keyword(
            previous_answer, FORMATION_KEYWORDS
        )
        if mention:
            return (
                f"Vous avez mentionné {mention}. Quelle formation suivez-vous ou "
                "avez-vous suivie, et en quoi vous prépare-t-elle à cette offre ?"
            )
        return (
            "Quelle formation suivez-vous ou avez-vous suivie, et en quoi "
            "est-elle adaptée à cette offre ?"
        )

    def _build_technical(self, context, previous_answer):
        tech = _extract_first_tech(previous_answer, context.offre)
        if tech is None:
            tech = self._first_unused_cv_skill(context)
        if tech:
            return (
                f"Vous avez mentionné {tech}. Pouvez-vous me parler d'un projet "
                "dans lequel vous avez utilisé cette technologie ?"
            )
        techs = _to_list(context.offre.get("technologies")) + _to_list(
            context.offre.get("competences")
        )
        if techs:
            liste = (
                f"{techs[0]}, {techs[1]} (entre autres)"
                if len(techs) > 2
                else " et ".join(techs)
            )
            return (
                f"L'offre requiert {liste}. Expliquez votre maîtrise de {techs[0]} "
                "et décrivez une situation où vous l'avez mise en pratique."
            )
        return "Quelles compétences techniques apportez-vous pour réussir dans cette offre ?"

    def _build_experience(self, context, previous_answer):
        titre = context.offre.get("titre") or "ce stage"
        mention = _extract_keyword(previous_answer, PROJECT_KEYWORDS) or self._cv_field(
            context, ("projets", "projet", "experiences")
        )
        if mention:
            return (
                f"Vous avez mentionné « {mention} ». Pouvez-vous détailler ce "
                "projet, votre rôle et les technologies utilisées ?"
            )
        return (
            f"Décrivez un projet (académique, personnel ou professionnel) "
            f"pertinent pour le stage « {titre} » et précisez votre rôle."
        )

    def _build_problem(self, context, previous_answer):
        titre = context.offre.get("titre") or "ce stage"
        missions = _shorten(context.offre.get("missions"), 120)
        contexte = (
            f"le stage « {titre} » (missions : {missions})"
            if missions
            else f"le stage « {titre} »"
        )
        if _extract_keyword(previous_answer, PROBLEM_KEYWORDS):
            return (
                f"Vous avez évoqué une démarche de résolution. Dans le cadre de "
                f"{contexte}, décrivez comment vous procéderiez pour une difficulté "
                "technique rencontrée pour la première fois."
            )
        return (
            f"Dans le cadre de {contexte}, décrivez comment vous procéderiez pour "
            "résoudre une difficulté technique que vous rencontrez pour la première fois."
        )

    def _build_teamwork(self, context, previous_answer):
        if _extract_keyword(previous_answer, TEAMWORK_KEYWORDS):
            return (
                "Vous avez évoqué un travail en équipe. Quel a été votre rôle exact "
                "et comment avez-vous communiqué avec les autres ?"
            )
        return (
            "Décrivez une expérience où vous avez travaillé en équipe : quel a été "
            "votre rôle et comment avez-vous communiqué avec les autres ?"
        )

    def _build_offer_specific(self, context, previous_answer):
        titre = context.offre.get("titre") or "ce stage"
        missions = _shorten(context.offre.get("missions"), 120)
        if missions:
            return (
                f"Le stage « {titre} » prévoit notamment : {missions}. "
                "Quelle mission vous attire le plus et comment comptez-vous y contribuer ?"
            )
        if context.offre.get("niveau"):
            return (
                f"Ce stage vise un niveau {context.offre.get('niveau')}. Que pouvez-vous "
                f"ajouter pour convaincre que vous êtes le candidat idéal pour « {titre} » ?"
            )
        return (
            f"Que pouvez-vous ajouter pour convaincre l'équipe que vous êtes le "
            f"candidat idéal pour le stage « {titre} » ?"
        )

    # ── Petits utilitaires internes ──────────────────────────────────────────

    def _ask(self, context, question):
        context.question_history.append(question)
        context.used_categories.add(question["categorie"])
        return question

    def _keywords_for(self, context, categorie):
        if categorie == CATEGORIE_MOTIVATION:
            return MOTIVATION_KEYWORDS
        if categorie == CATEGORIE_TECHNIQUE:
            return _to_list(context.offre.get("technologies")) + _to_list(
                context.offre.get("competences")
            )
        if categorie == CATEGORIE_FORMATION:
            return FORMATION_KEYWORDS
        if categorie == CATEGORIE_RESOLUTION:
            return PROBLEM_KEYWORDS
        if categorie == CATEGORIE_EQUIPE:
            return TEAMWORK_KEYWORDS
        if categorie in (CATEGORIE_EXPERIENCE, CATEGORIE_OFFRE):
            return PROJECT_KEYWORDS + PROBLEM_KEYWORDS
        return []

    def _cv_field(self, context, keys):
        cv = context.cv
        if isinstance(cv, dict):
            for key in keys:
                if key in cv:
                    value = cv[key]
                    if isinstance(value, (list, tuple)):
                        return value[0] if value else None
                    return str(value).strip() or None
        return None

    def _first_unused_cv_skill(self, context):
        skills = _to_list(self._cv_field(context, ("competences", "skills")))
        for skill in skills:
            norm = _norm(skill)
            if norm and norm not in context.used_technologies:
                return skill
        return None

    def _axis_key(self, categorie):
        return {
            CATEGORIE_PRESENTATION: "presentation",
            CATEGORIE_MOTIVATION: "motivation",
            CATEGORIE_FORMATION: "formation",
            CATEGORIE_TECHNIQUE: "technical",
            CATEGORIE_EXPERIENCE: "experience",
            CATEGORIE_RESOLUTION: "problem_solving",
            CATEGORIE_EQUIPE: "teamwork",
            CATEGORIE_OFFRE: "offer_specific",
        }[categorie]


# Instance partagée (le store l'utilise directement).
engine = InterviewEngine()

__all__ = [
    "InterviewContext",
    "InterviewEngine",
    "engine",
    "QUESTION_COUNT",
    "CATEGORIES",
]
