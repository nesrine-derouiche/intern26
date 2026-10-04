/**
 * ÉVALUATEUR D'ENTRETIEN IA — MOTEUR LOCAL DÉTERMINISTE.
 *
 * Produit une évaluation (score 0..100, axes, forces, faiblesses,
 * recommandation) À PARTIR DES RÉPONSES RÉELLES du candidat :
 * longueur, richesse, et correspondance avec les technologies / compétences
 * demandées par l'offre. Aucun aléa : le même couple (questions, réponses)
 * produit toujours la même évaluation.
 *
 * Ce moteur « local » est le fournisseur par défaut du service d'abstraction
 * IA (ai-interview.provider.service). Il sera remplacé — sans changer le
 * contrat de sortie — par un vrai fournisseur d'IA dès qu'il sera configuré.
 */

const SPLIT = /[,;\n]+/;

const toList = (value) =>
  value
    ? String(value)
        .split(SPLIT)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));

const words = (text) =>
  String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

/** Compte les occurrences (mot entier, insensible à la casse) d'une liste de mots-clés. */
function countKeywords(text, keywords) {
  const lower = String(text || '').toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = lower.match(new RegExp(`(?:^|[^a-zà-ÿ0-9])${escaped}(?:[^a-zà-ÿ0-9]|$)`, 'gi'));
    if (matches) hits += matches.length;
  }
  return hits;
}

const MOTIVATION_KEYWORDS = [
  'motiv', 'passion', 'intéress', 'envie', 'ambition', 'découvrir', 'apprendre',
  'rejoindre', 'équipe', 'contribution', 'objectif', 'développ', 'expérience',
  'améliorer', 'renforcer', 'savoir'
];
const PROBLEM_KEYWORDS = [
  'problème', 'problèmes', 'solution', 'solutions', 'analys', 'étudier',
  'étape', 'étapes', 'test', 'tests', 'débog', 'résoud', 'résolution',
  'méthode', 'plan', 'corrigé', 'contournement', 'documenter', 'erreur',
  'recherche', 'diagnostique'
];
const PROJECT_KEYWORDS = [
  'projet', 'stage', 'réalis', 'développé', 'développé', 'conçu', 'contexte',
  'équipe', 'github', 'application', 'site', 'module', 'cours', 'académique',
  'professionnel', 'travail', 'année', 'pfe', 'portfolio'
];

/** Score d'axe basé sur la proportion de réponses et la densité de mots-clés. */
function axisScore({ answered, total, answers, keywords, lengthWeight = 0.4, keywordWeight = 0.4, base = 0 }) {
  if (!total) return base;
  const answeredRatio = answered / total;
  const avgWords = answered ? answers.reduce((sum, a) => sum + words(a.answer), 0) / answered : 0;
  const hits = answers.reduce((sum, a) => sum + countKeywords(a.answer, keywords), 0);
  const lengthScore = Math.min(1, avgWords / 35);
  const keywordScore = Math.min(1, hits / Math.max(total, 1));
  return clampScore(100 * (base + lengthWeight * lengthScore + keywordWeight * keywordScore + 0.2 * answeredRatio));
}

class LocalAiInterviewEvaluator {
  /**
   * @param {{ offre: object, questions: Array<{question_number:number, categorie:string}>,
   *           answers: Array<{question_number:number, answer:string}> }} ctx
   * @returns {Promise<{ score:number, technical:number, motivation:number, communication:number,
   *           problemSolving:number, relevance:number, strengths:string[], weaknesses:string[],
   *           recommendation:'FAVORABLE'|'DEFAVORABLE' }>}
   */
  async evaluate(ctx) {
    const offre = ctx.offre || {};
    const questions = ctx.questions || [];
    const answers = (ctx.answers || []).filter((a) => String(a.answer || '').trim());

    const byNumber = new Map(questions.map((q) => [Number(q.question_number), q]));
    const group = (category) =>
      answers.filter((a) => (byNumber.get(Number(a.question_number)) || {}).categorie === category);

    const motivationAnswers = group('MOTIVATION');
    const technicalAnswers = group('TECHNIQUE');
    const projectAnswers = group('PROJET');
    const problemAnswers = group('RESOLUTION');
    const communicationAnswers = answers;

    const technologies = toList(offre.technologies);
    const competences = toList(offre.competences);
    const techKeywords = [...new Set([...technologies, ...competences].map((s) => s.toLowerCase()))];

    const motivation = axisScore({
      answered: motivationAnswers.length,
      total: 3,
      answers: motivationAnswers,
      keywords: MOTIVATION_KEYWORDS
    });

    const technical = techKeywords.length
      ? clampScore(18 + 100 * (0.5 * Math.min(1, technicalAnswers.length) +
          0.5 * Math.min(1, technicalAnswers.reduce((sum, a) => sum + countKeywords(a.answer, techKeywords), 0) / 3)))
      : axisScore({ answered: technicalAnswers.length, total: 1, answers: technicalAnswers, keywords: MOTIVATION_KEYWORDS, base: 0.15 });

    const communication = clampScore(
      100 * (0.3 * (answers.length / Math.max(questions.length || 1, 1)) + 0.7 * Math.min(1, (answers.reduce((s, a) => s + words(a.answer), 0) / Math.max(answers.length, 1)) / 30))
    );

    const problemSolving = axisScore({
      answered: problemAnswers.length,
      total: 1,
      answers: problemAnswers,
      keywords: PROBLEM_KEYWORDS,
      base: 0.1
    });

    const relevance = axisScore({
      answered: projectAnswers.length,
      total: 1,
      answers: [...projectAnswers, ...technicalAnswers],
      keywords: PROJECT_KEYWORDS,
      base: 0.1
    });

    const score = clampScore(
      technical * 0.25 + motivation * 0.2 + communication * 0.15 + problemSolving * 0.2 + relevance * 0.2
    );

    const strengths = [];
    const weaknesses = [];

    if (motivation >= 60) strengths.push('Bonne motivation et intérêt pour le stage');
    if (technical >= 60) strengths.push('Bonnes compétences techniques en lien avec l\'offre');
    if (communication >= 60) strengths.push('Bonne expression et clarté des réponses');
    if (problemSolving >= 60) strengths.push('Approche structurée de résolution de problèmes');
    if (relevance >= 60) strengths.push('Profil cohérent avec les exigences de l\'offre');
    if (!strengths.length) strengths.push('Profil à confirmer lors de l\'entretien humain');

    if (motivation < 50) weaknesses.push('Motivation à renforcer');
    if (technical < 50) weaknesses.push('Compétences techniques à approfondir');
    if (communication < 50) weaknesses.push('Communication à améliorer (réponses plus développées)');
    if (problemSolving < 50) weaknesses.push('Approche de résolution de problèmes à structurer');
    if (relevance < 50) weaknesses.push('Projets et expériences à valoriser davantage');
    if (answers.length < Math.ceil((questions.length || 8) / 2)) weaknesses.push('Plusieurs questions restées sans réponse');

    if (score >= 60 && weaknesses.length === 0) weaknesses.push('Aucune faiblesse majeure détectée');

    return {
      score,
      technical,
      motivation,
      communication,
      problemSolving,
      relevance,
      strengths,
      weaknesses,
      recommendation: score >= 60 ? 'FAVORABLE' : 'DEFAVORABLE'
    };
  }
}

module.exports = new LocalAiInterviewEvaluator();
