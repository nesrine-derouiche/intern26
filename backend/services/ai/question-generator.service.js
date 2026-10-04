/**
 * GÉNÉRATEUR DE QUESTIONS D'ENTRETIEN IA.
 *
 * Produit un questionnaire de 8 questions adapté à une offre de stage :
 * les questions techniques sont dérivées des technologies / compétences
 * demandées par l'offre (offre_stage.technologies, .competences_demandees),
 * le reste suit une trame fixe (motivation, projet, résolution, comportemental).
 *
 * La structure est volontairement ouverte : ajouter une question consiste à
 * ajouter un « template » dans `builders` — la génération reste automatique.
 */

const SPLIT = /[,;\n]+/;

const toList = (value) =>
  value
    ? String(value)
        .split(SPLIT)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/** Question technique dérivée des exigences de l'offre. */
function buildTechnicalQuestion(technologies, competences) {
  const techs = technologies.length ? technologies : competences;
  if (techs.length) {
    const liste = techs.length > 2
      ? `${techs.slice(0, 2).join(', ')} (entre autres)`
      : techs.join(' et ');
    return `L'offre requiert ${liste}. Expliquez votre maîtrise de ${
      techs[0]
    } et décrivez une situation où vous l'avez mise en pratique.`;
  }
  return 'Quelles compétences techniques apportez-vous pour réussir dans cette offre ?';
}

/** Question de résolution de problème, contextualisée à l'offre. */
function buildProblemSolvingQuestion(titreOffre) {
  return `Dans le cadre d'un stage comme « ${titreOffre} », décrivez comment vous procéderiez pour résoudre une difficulté technique que vous rencontrez en première fois.`;
}

class QuestionGeneratorService {
  /** Nombre de questions d'un entretien IA. */
  static get COUNT() {
    return 8;
  }

  /**
   * Génère les 8 questions d'un entretien à partir des exigences de l'offre.
   * @param {{ offre: { titre: string, departement_nom?: string, technologies?: string[], competences?: string[] } }} ctx
   * @returns {{ question_number: number, categorie: string, question: string }[]}
   */
  generateQuestions(ctx) {
    const offre = (ctx && ctx.offre) || {};
    const titre = offre.titre || 'ce stage';
    const departement = offre.departement_nom || 'votre domaine';
    const technologies = toList(offre.technologies);
    const competences = toList(offre.competences);

    const templates = [
      { categorie: 'MOTIVATION', question: 'Présentez-vous brièvement.' },
      {
        categorie: 'MOTIVATION',
        question: `Pourquoi souhaitez-vous effectuer le stage « ${titre} » ?`
      },
      {
        categorie: 'MOTIVATION',
        question: `Pourquoi avez-vous choisi de vous orienter vers ${departement} ?`
      },
      {
        categorie: 'PROJET',
        question: `Décrivez un projet (académique, personnel ou professionnel) pertinent pour le stage « ${titre} » et précisez votre rôle.`
      },
      {
        categorie: 'TECHNIQUE',
        question: buildTechnicalQuestion(technologies, competences)
      },
      {
        categorie: 'RESOLUTION',
        question: buildProblemSolvingQuestion(titre)
      },
      {
        categorie: 'COMPORTEMENTAL',
        question: 'Décrivez une expérience où vous avez travaillé en équipe : quel a été votre rôle et comment avez-vous communiqué avec les autres ?'
      },
      {
        categorie: 'MOTIVATION',
        question: 'Que pouvez-vous ajouter pour convaincre l\'équipe que vous êtes le candidat idéal pour ce stage ?'
      }
    ];

    return templates.map((t, index) => ({
      question_number: index + 1,
      categorie: t.categorie,
      question: t.question
    }));
  }
}

module.exports = new QuestionGeneratorService();
