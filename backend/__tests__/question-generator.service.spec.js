const questionGenerator = require('../services/ai/question-generator.service');

describe('QuestionGeneratorService', () => {
  test('génère exactement 8 questions numérotées de 1 à 8', () => {
    const questions = questionGenerator.generateQuestions({
      offre: { titre: 'Développeur Node.js', departement_nom: 'Informatique' }
    });

    expect(questions).toHaveLength(8);
    expect(questions.map((q) => q.question_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('chaque question porte une catégorie et un libellé non vide', () => {
    const questions = questionGenerator.generateQuestions({
      offre: { titre: 'Technicien Réseau' }
    });

    for (const q of questions) {
      expect(q.categorie).toBeTruthy();
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  test('la question technique est dérivée des technologies de l’offre', () => {
    const questions = questionGenerator.generateQuestions({
      offre: {
        titre: 'Data Analyst',
        technologies: ['Python', 'SQL', 'Power BI']
      }
    });

    const technical = questions.find((q) => q.categorie === 'TECHNIQUE');
    expect(technical.question).toContain('Python');
    expect(technical.question).toContain('SQL');
  });

  test('la question technique retombe sur les compétences sans technologies', () => {
    const questions = questionGenerator.generateQuestions({
      offre: { titre: 'Stage Général', competences: ['Excel'] }
    });

    const technical = questions.find((q) => q.categorie === 'TECHNIQUE');
    expect(technical.question).toContain('Excel');
  });

  test('la question technique est générique sans technologies ni compétences', () => {
    const questions = questionGenerator.generateQuestions({ offre: { titre: 'Stage' } });
    const technical = questions.find((q) => q.categorie === 'TECHNIQUE');
    expect(technical.question).toContain('compétences techniques');
  });

  test('la question de résolution est contextualisée au titre de l’offre', () => {
    const questions = questionGenerator.generateQuestions({
      offre: { titre: 'Assistant Comptable' }
    });
    const resolution = questions.find((q) => q.categorie === 'RESOLUTION');
    expect(resolution.question).toContain('Assistant Comptable');
  });

  test('gère une offre absente', () => {
    const questions = questionGenerator.generateQuestions({});
    expect(questions).toHaveLength(8);
  });
});
