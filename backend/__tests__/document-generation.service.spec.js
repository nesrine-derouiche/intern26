jest.mock('../repositories/stage.repository', () => ({
  findPdfData: jest.fn()
}));

jest.mock('../repositories/evaluation.repository', () => ({
  findPdfData: jest.fn()
}));

jest.mock('../repositories/document-template.repository', () => ({
  findActiveByType: jest.fn(),
  createGenerated: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const path = require('path');
const documentGenerationService = require('../services/document-generation.service');
const stageRepository = require('../repositories/stage.repository');
const evaluationRepository = require('../repositories/evaluation.repository');
const documentTemplateRepository = require('../repositories/document-template.repository');
const logger = require('../utils/logger');
const { UPLOAD_DIR } = require('../config/uploads');

const STAGE_ID = '33333333-3333-4333-8333-333333333333';
const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const GENERATED_ID = '55555555-5555-4555-8555-555555555555';

const STAGE_DATA = {
  id: STAGE_ID,
  candidature_id: null,
  stagiaire_id: '66666666-6666-4666-8666-666666666666',
  encadrant_id: '77777777-7777-4777-8777-777777777777',
  departement_id: '88888888-8888-4888-8888-888888888888',
  offre_id: '99999999-9999-4999-8999-999999999999',
  stagiaire_nom: 'Trabelsi',
  stagiaire_prenom: 'Fatma',
  stagiaire_email: 'fatma.trabelsi@steg.tn',
  encadrant_nom: 'Bensalah',
  encadrant_prenom: 'Ahmed',
  encadrant_email: 'ahmed.bensalah@steg.tn',
  departement_nom: 'Informatique',
  offre_titre: 'Stage Developpement',
  offre_desc: 'Mission de developpement interne',
  date_debut: new Date('2026-02-01T00:00:00.000Z'),
  date_fin: new Date('2026-06-30T00:00:00.000Z'),
  statut: 'EN_COURS'
};

const EVALUATION_DATA = {
  id: '44444444-4444-4444-8444-444444444444',
  stage_id: STAGE_ID,
  encadrant_id: STAGE_DATA.encadrant_id,
  technique: 15,
  communication: 14,
  autonomie: 16,
  ponctualite: 15,
  qualite: 17,
  note_finale: 15.4,
  commentaire: 'Bon travail',
  date_evaluation: new Date('2026-06-25T00:00:00.000Z'),
  validee: true,
  stagiaire_nom: 'Trabelsi',
  stagiaire_prenom: 'Fatma',
  encadrant_nom: 'Bensalah',
  encadrant_prenom: 'Ahmed',
  departement_nom: 'Informatique',
  offre_titre: 'Stage Developpement'
};

const CONVENTION_TEMPLATE = {
  id: TEMPLATE_ID,
  nom: 'Convention de stage',
  type: 'CONVENTION',
  contenu: 'Convention de {{stagiaire_prenom}} {{stagiaire_nom}} - {{departement_nom}}',
  variables: ['stagiaire_prenom', 'stagiaire_nom', 'departement_nom'],
  actif: true,
  version: 3,
  created_by: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

function mockTemplate(overrides = {}) {
  return { ...CONVENTION_TEMPLATE, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  stageRepository.findPdfData.mockResolvedValue(STAGE_DATA);
  evaluationRepository.findPdfData.mockResolvedValue(EVALUATION_DATA);
  documentTemplateRepository.findActiveByType.mockResolvedValue([CONVENTION_TEMPLATE]);
  documentTemplateRepository.createGenerated.mockImplementation(async (payload) => ({
    id: GENERATED_ID,
    ...payload,
    created_at: new Date('2026-09-30T00:00:00.000Z')
  }));
});

describe('DocumentGenerationService — génération', () => {
  test('1. génération avec template actif : contenu rendu et historisation', async () => {
    const result = await documentGenerationService.generate({
      stageId: STAGE_ID,
      type: 'CONVENTION'
    });

    expect(result.generated).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.rendered).toBe('Convention de Fatma Trabelsi - Informatique');
    expect(result.template_id).toBe(TEMPLATE_ID);
    expect(result.template_version).toBe(3);
    expect(result.type).toBe('CONVENTION');
  });

  test('2. sélection de la version active la plus élevée, indépendamment de l\'ordre reçu', async () => {
    documentTemplateRepository.findActiveByType.mockResolvedValue([
      mockTemplate({ version: 3 }),
      mockTemplate({ version: 7, contenu: 'Version sept {{stagiaire_prenom}} {{stagiaire_nom}} - {{departement_nom}}' }),
      mockTemplate({ version: 5, contenu: 'Version cinq {{stagiaire_prenom}} {{stagiaire_nom}} - {{departement_nom}}' })
    ]);

    const result = await documentGenerationService.generate({ stageId: STAGE_ID, type: 'CONVENTION' });

    expect(result.template_version).toBe(7);
    expect(result.rendered).toContain('Version sept');
    expect(documentTemplateRepository.createGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ template_version: 7 })
    );
  });

  test('3. aucun template actif : résultat explicite, aucune écriture', async () => {
    documentTemplateRepository.findActiveByType.mockResolvedValue([]);

    const result = await documentGenerationService.generate({ stageId: STAGE_ID, type: 'CONVENTION' });

    expect(result).toEqual({
      generated: false,
      reason: 'NO_ACTIVE_TEMPLATE',
      type: 'CONVENTION',
      stage_id: STAGE_ID
    });
    expect(documentTemplateRepository.createGenerated).not.toHaveBeenCalled();
    expect(result.rendered).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('DocumentGenerationService — données et variables', () => {
  test('4. les données du stage proviennent de stageRepository.findPdfData', async () => {
    const result = await documentGenerationService.generate({ stageId: STAGE_ID, type: 'CONVENTION' });

    expect(stageRepository.findPdfData).toHaveBeenCalledWith(STAGE_ID);
    expect(evaluationRepository.findPdfData).not.toHaveBeenCalled();
    expect(result.stage_id).toBe(STAGE_ID);
    expect(result.variables.stagiaire_nom).toBe('Trabelsi');
    expect(result.variables.offre_titre).toBe('Stage Developpement');
  });

  test('5. EVALUATION : données d\'évaluation chargées, motif NO_TEMPLATE_TYPE documenté', async () => {
    const result = await documentGenerationService.generate({ stageId: STAGE_ID, type: 'EVALUATION' });

    expect(evaluationRepository.findPdfData).toHaveBeenCalledWith(STAGE_ID);
    expect(stageRepository.findPdfData).not.toHaveBeenCalled();
    expect(result.generated).toBe(false);
    expect(result.reason).toBe('NO_TEMPLATE_TYPE');
    expect(documentTemplateRepository.findActiveByType).not.toHaveBeenCalled();
    expect(documentTemplateRepository.createGenerated).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('type_document')
    );
  });

  test('6. construction des variables : données réelles + dataOverride, valeurs nulles ignorées', async () => {
    const result = await documentGenerationService.generate({
      stageId: STAGE_ID,
      type: 'CONVENTION',
      dataOverride: { stagiaire_nom: 'Ben Ali', entreprise_nom: 'STEG Sud' }
    });

    expect(result.variables.stagiaire_nom).toBe('Ben Ali');
    expect(result.variables.entreprise_nom).toBe('STEG Sud');
    expect(result.variables.stagiaire_prenom).toBe('Fatma');
    expect(result.variables.candidature_id).toBeUndefined();
    expect(result.variables).not.toHaveProperty('inconnue');
  });

  test('7. rendu : occurrences multiples et échappement HTML des valeurs injectées', async () => {
    documentTemplateRepository.findActiveByType.mockResolvedValue([
      mockTemplate({
        contenu: '{{stagiaire_prenom}} {{stagiaire_nom}} et {{stagiaire_prenom}} {{stagiaire_nom}}',
        variables: ['stagiaire_prenom', 'stagiaire_nom']
      })
    ]);

    const result = await documentGenerationService.generate({
      stageId: STAGE_ID,
      type: 'CONVENTION',
      dataOverride: { stagiaire_nom: '<script>alert(1)</script>' }
    });

    expect(result.rendered.match(/Fatma/g)).toHaveLength(2);
    expect(result.rendered).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.rendered).not.toContain('<script>');
  });

  test('8. variable obligatoire absente : erreur métier 422, aucune écriture', async () => {
    documentTemplateRepository.findActiveByType.mockResolvedValue([
      mockTemplate({
        contenu: 'Societe {{entreprise_nom}} pour {{stagiaire_prenom}}',
        variables: ['entreprise_nom', 'stagiaire_prenom']
      })
    ]);

    const error = await documentGenerationService
      .generate({ stageId: STAGE_ID, type: 'CONVENTION' })
      .then(() => null)
      .catch((err) => err);

    expect(error).toMatchObject({ statusCode: 422 });
    expect(error.message).toContain('entreprise_nom');
    expect(documentTemplateRepository.createGenerated).not.toHaveBeenCalled();
  });
});

describe('DocumentGenerationService — historisation document_generated', () => {
  let result;

  beforeEach(async () => {
    result = await documentGenerationService.generate({ stageId: STAGE_ID, type: 'CONVENTION' });
  });

  test('9. une ligne document_generated est créée via le repository existant', async () => {
    expect(documentTemplateRepository.createGenerated).toHaveBeenCalledTimes(1);

    const payload = documentTemplateRepository.createGenerated.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'chemin',
      'stage_id',
      'template_id',
      'template_version',
      'variables'
    ]);
    expect(result.id).toBe(GENERATED_ID);
  });

  test('10. template_id correctement enregistré', () => {
    const payload = documentTemplateRepository.createGenerated.mock.calls[0][0];
    expect(payload.template_id).toBe(TEMPLATE_ID);
    expect(result.template_id).toBe(TEMPLATE_ID);
  });

  test('11. template_version correctement enregistrée', () => {
    const payload = documentTemplateRepository.createGenerated.mock.calls[0][0];
    expect(payload.template_version).toBe(3);
    expect(result.template_version).toBe(3);
  });

  test('12. stage_id correctement enregistré', () => {
    const payload = documentTemplateRepository.createGenerated.mock.calls[0][0];
    expect(payload.stage_id).toBe(STAGE_ID);
    expect(result.stage_id).toBe(STAGE_ID);
  });

  test('13. variables JSON enregistrées comme objet (et non chaîne)', () => {
    const payload = documentTemplateRepository.createGenerated.mock.calls[0][0];

    expect(typeof payload.variables).toBe('object');
    expect(Array.isArray(payload.variables)).toBe(false);
    expect(payload.variables.stagiaire_nom).toBe('Trabelsi');
    expect(payload.variables.departement_nom).toBe('Informatique');
    expect(result.variables).toEqual(payload.variables);
  });

  test('14. chemin de fichier généré selon UPLOAD_DIR et la convention de nommage', () => {
    expect(result.chemin).toMatch(/^\d+-\d+\.pdf$/);
    expect(result.path).toBe(path.join(UPLOAD_DIR, result.chemin));
    expect(result.path.startsWith(UPLOAD_DIR)).toBe(true);
    expect(result.pdf).toEqual({ written: false, delegate: 'pdf.service' });
  });
});

describe('DocumentGenerationService — erreurs', () => {
  test('15. erreur repository neutralisée : 500 sans détail SQL, loggée', async () => {
    stageRepository.findPdfData.mockRejectedValue({
      code: '42P01',
      message: 'relation "stage" does not exist'
    });

    const error = await documentGenerationService
      .generate({ stageId: STAGE_ID, type: 'CONVENTION' })
      .then(() => null)
      .catch((err) => err);

    expect(error).toMatchObject({ statusCode: 500 });
    expect(error.message).not.toContain('relation');
    expect(error.message).not.toContain('stage"');
    expect(logger.error).toHaveBeenCalled();
    expect(documentTemplateRepository.createGenerated).not.toHaveBeenCalled();
  });

  test('16. stage introuvable → 404, aucune recherche de template', async () => {
    stageRepository.findPdfData.mockResolvedValue(undefined);

    const error = await documentGenerationService
      .generate({ stageId: STAGE_ID, type: 'CONVENTION' })
      .then(() => null)
      .catch((err) => err);

    expect(error).toMatchObject({ statusCode: 404, message: 'Stage introuvable.' });
    expect(documentTemplateRepository.findActiveByType).not.toHaveBeenCalled();
  });

  test('17. entrées invalides : type non pris en charge → 422, stageId manquant → 400', async () => {
    const unknownType = await documentGenerationService
      .generate({ stageId: STAGE_ID, type: 'FACTURE' })
      .then(() => null)
      .catch((err) => err);
    expect(unknownType).toMatchObject({ statusCode: 422 });

    const missingStage = await documentGenerationService
      .generate({ type: 'CONVENTION' })
      .then(() => null)
      .catch((err) => err);
    expect(missingStage).toMatchObject({ statusCode: 400 });

    expect(stageRepository.findPdfData).not.toHaveBeenCalled();
    expect(documentTemplateRepository.findActiveByType).not.toHaveBeenCalled();
  });
});
