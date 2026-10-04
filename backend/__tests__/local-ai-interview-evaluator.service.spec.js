const evaluator = require('../services/ai/evaluators/local-ai-interview-evaluator.service');

const QUESTIONS = Array.from({ length: 8 }, (_, i) => ({
  question_number: i + 1,
  categorie: ['MOTIVATION', 'MOTIVATION', 'MOTIVATION', 'PROJET', 'TECHNIQUE', 'RESOLUTION', 'COMPORTEMENTAL', 'MOTIVATION'][i]
}));

const OFFRE = {
  titre: 'Développeur Node.js',
  technologies: 'Node.js, Express',
  competences: 'JavaScript, SQL'
};

function answerFor(number, text) {
  return { question_number: number, answer: text };
}

describe('LocalAiInterviewEvaluator — évaluation déterministe', () => {
  test('produit un score 0..100 et une recommandation pour des réponses solides', async () => {
    const answers = QUESTIONS.map((q, i) =>
      answerFor(
        q.question_number,
        `Je suis motivé(e) par ce stage, je souhaite apprendre et contribuer en équipe. ` +
          `Pour le projet, j'ai développé une application complète avec Node.js, JavaScript et SQL. ` +
          `Face à un problème, j'analyse, je teste une solution, je documente l'erreur et je corrige. ` +
          `Je communique clairement et je collabore avec les autres (question ${i + 1}).`
      )
    );

    const result = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['FAVORABLE', 'DEFAVORABLE']).toContain(result.recommendation);
    for (const axe of ['technical', 'motivation', 'communication', 'problemSolving', 'relevance']) {
      expect(result[axe]).toBeGreaterThanOrEqual(0);
      expect(result[axe]).toBeLessThanOrEqual(100);
    }
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(Array.isArray(result.weaknesses)).toBe(true);
  });

  test('le même couple (questions, réponses) produit toujours le même résultat', async () => {
    const answers = [answerFor(1, 'Je suis motivée et je souhaite apprendre en équipe.')];
    const a = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers });
    const b = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers });
    expect(a).toEqual(b);
  });

  test('des réponses vides ou très courtes donnent une recommandation DEFAVORABLE', async () => {
    const result = await evaluator.evaluate({
      offre: OFFRE,
      questions: QUESTIONS,
      answers: [answerFor(1, 'oui')]
    });
    expect(result.recommendation).toBe('DEFAVORABLE');
    expect(result.score).toBeLessThan(60);
  });

  test('des réponses complètes et ciblées donnent une recommandation FAVORABLE', async () => {
    const text = (n) =>
      `Question ${n} : je suis très motivé par ce stage, passionné par l'informatique. ` +
      `J'ai réalisé des projets concrets en Node.js, Express, JavaScript et SQL. ` +
      `En équipe, je communique régulièrement. Face à un problème, j'analyse, je planifie, je teste des solutions et je corrige. ` +
      `Cette expérience est en lien direct avec les technologies de l'offre et renforce mon ambition de rejoindre votre équipe.`;

    const answers = QUESTIONS.map((q, i) => answerFor(q.question_number, text(i + 1)));
    const result = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers });
    expect(result.recommendation).toBe('FAVORABLE');
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test('les axes techniques montent quand les réponses citent les technologies de l’offre', async () => {
    const technicalAnswer = answerFor(5, 'Je maîtrise Node.js et Express pour des API, et SQL pour les données.');
    const low = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers: [answerFor(5, 'bof')] });
    const high = await evaluator.evaluate({ offre: OFFRE, questions: QUESTIONS, answers: [technicalAnswer] });
    expect(high.technical).toBeGreaterThan(low.technical);
  });

  test('signale les questions sans réponse', async () => {
    const result = await evaluator.evaluate({
      offre: OFFRE,
      questions: QUESTIONS,
      answers: [answerFor(1, 'Une seule réponse courte')]
    });
    expect(result.weaknesses).toContain('Plusieurs questions restées sans réponse');
  });
});
