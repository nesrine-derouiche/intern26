const mockAiInterview = require('../services/ai/mock-ai.service');

describe('MockAiInterviewService — moteur d’entretien IA simulé', () => {
  const originalStatus = process.env.AI_MOCK_STATUS;
  const originalScore = process.env.AI_MOCK_SCORE;

  afterEach(() => {
    if (originalStatus === undefined) delete process.env.AI_MOCK_STATUS;
    else process.env.AI_MOCK_STATUS = originalStatus;
    if (originalScore === undefined) delete process.env.AI_MOCK_SCORE;
    else process.env.AI_MOCK_SCORE = originalScore;
  });

  test('respecte le contrat { score, status } avec des valeurs valides', async () => {
    const result = await mockAiInterview.runInterview({ candidatureId: 'cand-x' });
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['PASSED', 'FAILED']).toContain(result.status);
  });

  test('est déterministe pour une même candidature', async () => {
    const a = await mockAiInterview.runInterview({ candidatureId: 'cand-abc' });
    const b = await mockAiInterview.runInterview({ candidatureId: 'cand-abc' });
    expect(a).toEqual(b);
  });

  test('AI_MOCK_SCORE force le score et en déduit le statut', async () => {
    process.env.AI_MOCK_SCORE = '42';
    const result = await mockAiInterview.runInterview({ candidatureId: 'cand-any' });
    expect(result.score).toBe(42);
    expect(result.status).toBe('FAILED');
  });

  test('AI_MOCK_STATUS force le sens indépendamment du score', async () => {
    process.env.AI_MOCK_SCORE = '10';
    process.env.AI_MOCK_STATUS = 'PASSED';
    const result = await mockAiInterview.runInterview({ candidatureId: 'cand-any' });
    expect(result.status).toBe('PASSED');
  });
});
