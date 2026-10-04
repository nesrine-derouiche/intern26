jest.mock('../repositories/document-template.repository', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findActiveByType: jest.fn(),
  findLatestByType: jest.fn(),
  update: jest.fn(),
  deactivate: jest.fn(),
  createGenerated: jest.fn(),
  findGeneratedById: jest.fn(),
  findGeneratedByStageId: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const documentTemplateService = require('../services/document-template.service');
const documentTemplateRepository = require('../repositories/document-template.repository');
const logger = require('../utils/logger');

const TEMPLATE = {
  id: '11111111-1111-4111-8111-111111111111',
  nom: 'Convention STEG',
  type: 'CONVENTION',
  contenu: 'Bonjour {{stagiaire_nom}}',
  variables: ['stagiaire_nom'],
  actif: true,
  version: 1,
  created_by: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const VALID_BODY = {
  nom: 'Convention STEG',
  type: 'CONVENTION',
  contenu: 'Bonjour {{stagiaire_nom}}',
  variables: ['stagiaire_nom']
};

const pgError = (code, message) => Object.assign(new Error(message || 'database error'), { code });

beforeEach(() => {
  jest.clearAllMocks();
  documentTemplateRepository.findLatestByType.mockResolvedValue(null);
  documentTemplateRepository.create.mockImplementation(async (data) => ({ ...TEMPLATE, ...data }));
  documentTemplateRepository.findById.mockResolvedValue(TEMPLATE);
  documentTemplateRepository.findAll.mockResolvedValue([TEMPLATE]);
  documentTemplateRepository.update.mockImplementation(async (id, data) => ({ ...TEMPLATE, ...data }));
  documentTemplateRepository.deactivate.mockResolvedValue({ ...TEMPLATE, actif: false });
});

describe('DocumentTemplateService — création', () => {
  test('createTemplate crée un template à la version 1 quand aucun type n\'existe', async () => {
    const created = await documentTemplateService.createTemplate({ ...VALID_BODY });

    expect(documentTemplateRepository.findLatestByType).toHaveBeenCalledWith('CONVENTION');
    expect(documentTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...VALID_BODY, variables: ['stagiaire_nom'], version: 1, actif: true })
    );
    expect(created.id).toBe(TEMPLATE.id);
  });

  test('createTemplate crée la version suivante à partir de la version existante', async () => {
    documentTemplateRepository.findLatestByType.mockResolvedValue({ ...TEMPLATE, version: 3 });

    await documentTemplateService.createTemplate({ ...VALID_BODY });

    expect(documentTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 })
    );
  });

  test('createTemplate accepte une version explicite sans recalcul', async () => {
    await documentTemplateService.createTemplate({ ...VALID_BODY, version: 7 });

    expect(documentTemplateRepository.findLatestByType).not.toHaveBeenCalled();
    expect(documentTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 7 })
    );
  });

  test('createTemplate refuse un type hors enum type_document (422)', async () => {
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, type: 'FACTURE' })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
    expect(documentTemplateRepository.findLatestByType).not.toHaveBeenCalled();
  });

  test('createTemplate transforme un conflit UNIQUE(type, version) en 409', async () => {
    documentTemplateRepository.create.mockRejectedValue(pgError('23505', 'duplicate key value violates unique constraint'));

    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('createTemplate n\'expose jamais l\'erreur SQL brute (500 neutralisé)', async () => {
    documentTemplateRepository.create.mockRejectedValue(
      pgError('42P01', 'relation "document_template" does not exist')
    );

    const error = await documentTemplateService
      .createTemplate({ ...VALID_BODY })
      .then(() => null)
      .catch((err) => err);

    expect(error).toMatchObject({ statusCode: 500 });
    expect(error.message).not.toContain('document_template');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('DocumentTemplateService — validation des variables', () => {
  test('rejecte une variable utilisée dans le contenu mais inconnue de la liste (422)', async () => {
    await expect(
      documentTemplateService.createTemplate({
        ...VALID_BODY,
        variables: ['autre_variable']
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
  });

  test('rejecte un nom de variable qui n\'est pas un identifiant simple (422)', async () => {
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, variables: ['stagiaire nom'] })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, variables: ['{{x}}'] })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, variables: ['objet.champ'] })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
  });

  test('rejecte un champ variables qui n\'est pas un tableau (422)', async () => {
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, variables: 'stagiaire_nom' })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
  });

  test('rejecte les constructions exécutables (422)', async () => {
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, variables: ['__proto__'] })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.createTemplate({
        ...VALID_BODY,
        contenu: 'Bonjour {{constructor.constructor}}'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, contenu: 'Bonjour {{nom }}' })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.createTemplate({ ...VALID_BODY, contenu: 'Bonjour {{nom' })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
  });

  test('un avertissement est loggé pour une variable déclarée mais inutilisée, sans erreur', async () => {
    const created = await documentTemplateService.createTemplate({
      ...VALID_BODY,
      variables: ['stagiaire_nom', 'date_debut']
    });

    expect(created).toBeDefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][0]).toContain('date_debut');
    expect(documentTemplateRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ variables: ['stagiaire_nom', 'date_debut'] })
    );
  });
});

describe('DocumentTemplateService — récupération et liste', () => {
  test('getTemplateById renvoie le template', async () => {
    const template = await documentTemplateService.getTemplateById(TEMPLATE.id);

    expect(documentTemplateRepository.findById).toHaveBeenCalledWith(TEMPLATE.id);
    expect(template.id).toBe(TEMPLATE.id);
  });

  test('getTemplateById renvoie 404 quand le template n\'existe pas', async () => {
    documentTemplateRepository.findById.mockResolvedValue(null);

    await expect(
      documentTemplateService.getTemplateById('22222222-2222-4222-8222-222222222222')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getTemplateById transforme une erreur SQL de type UUID en 404', async () => {
    documentTemplateRepository.findById.mockRejectedValue(
      pgError('22P02', 'invalid input syntax for type uuid: "abc"')
    );

    const error = await documentTemplateService
      .getTemplateById(TEMPLATE.id)
      .then(() => null)
      .catch((err) => err);

    expect(error).toMatchObject({ statusCode: 404 });
    expect(error.message).not.toContain('uuid');
  });

  test('listTemplates sans pagination renvoie un tableau brut', async () => {
    const rows = await documentTemplateService.listTemplates({ type: 'CONVENTION' });

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toEqual([TEMPLATE]);
    expect(documentTemplateRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONVENTION', enabled: false })
    );
  });

  test('listTemplates paginée renvoie { data, total, page, pages }', async () => {
    documentTemplateRepository.findAll.mockResolvedValue({ data: [TEMPLATE], total: 1 });

    const result = await documentTemplateService.listTemplates({ page: 2, limit: 10 });

    expect(result).toEqual({ data: [TEMPLATE], total: 1, page: 2, pages: 1 });
    expect(documentTemplateRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, page: 2, limit: 10, offset: 10 })
    );
  });

  test('listTemplates refuse un type ou un filtre actif inconnu (422)', async () => {
    await expect(
      documentTemplateService.listTemplates({ type: 'FACTURE' })
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      documentTemplateService.listTemplates({ actif: 'peut-être' })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.findAll).not.toHaveBeenCalled();
  });
});

describe('DocumentTemplateService — modification', () => {
  test('updateTemplate ne transmet que nom, contenu et variables', async () => {
    const updated = await documentTemplateService.updateTemplate(TEMPLATE.id, {
      nom: 'Convention STEG 2026',
      type: 'CV',
      version: 42,
      actif: false
    });

    expect(documentTemplateRepository.findById).toHaveBeenCalledWith(TEMPLATE.id);
    expect(documentTemplateRepository.update).toHaveBeenCalledWith(TEMPLATE.id, {
      nom: 'Convention STEG 2026'
    });
    expect(updated.nom).toBe('Convention STEG 2026');
  });

  test('updateTemplate conserve type et version de la ligne existante', async () => {
    const updated = await documentTemplateService.updateTemplate(TEMPLATE.id, {
      contenu: 'Bonjour {{stagiaire_nom}}, fidèle {{stagiaire_nom}}.'
    });

    expect(updated.type).toBe(TEMPLATE.type);
    expect(updated.version).toBe(TEMPLATE.version);
    expect(documentTemplateRepository.update).toHaveBeenCalledWith(TEMPLATE.id, {
      contenu: 'Bonjour {{stagiaire_nom}}, fidèle {{stagiaire_nom}}.'
    });
  });

  test('updateTemplate renvoie 404 si le template n\'existe pas', async () => {
    documentTemplateRepository.findById.mockResolvedValue(null);

    await expect(
      documentTemplateService.updateTemplate('22222222-2222-4222-8222-222222222222', { nom: 'X' })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(documentTemplateRepository.update).not.toHaveBeenCalled();
  });

  test('updateTemplate refuse un contenu qui référence une variable non déclarée (422)', async () => {
    await expect(
      documentTemplateService.updateTemplate(TEMPLATE.id, { contenu: 'Bonjour {{entreprise_nom}}' })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(documentTemplateRepository.update).not.toHaveBeenCalled();
  });

  test('updateTemplate refuse un payload sans champ modifiable (400)', async () => {
    await expect(documentTemplateService.updateTemplate(TEMPLATE.id, {})).rejects.toMatchObject({
      statusCode: 400
    });
    await expect(
      documentTemplateService.updateTemplate(TEMPLATE.id, { type: 'CV', version: 9 })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(documentTemplateRepository.update).not.toHaveBeenCalled();
  });
});

describe('DocumentTemplateService — désactivation', () => {
  test('deactivateTemplate conserve la ligne et ne supprime rien', async () => {
    const result = await documentTemplateService.deactivateTemplate(TEMPLATE.id);

    expect(documentTemplateRepository.deactivate).toHaveBeenCalledWith(TEMPLATE.id);
    expect(result.actif).toBe(false);
    expect(result.id).toBe(TEMPLATE.id);
  });

  test('deactivateTemplate renvoie 404 quand la ligne n\'existe pas', async () => {
    documentTemplateRepository.deactivate.mockResolvedValue(null);

    await expect(
      documentTemplateService.deactivateTemplate('22222222-2222-4222-8222-222222222222')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('DocumentTemplateService — rendu', () => {
  test('renderTemplate remplace la variable et échappe le HTML injecté', () => {
    const html = documentTemplateService.renderTemplate(
      { ...TEMPLATE, contenu: 'Bonjour {{stagiaire_nom}},' },
      { stagiaire_nom: '<script>alert("x")</script>' }
    );

    expect(html).toBe('Bonjour &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;,');
  });

  test('renderTemplate échappe les apostrophes et les chevrons', () => {
    const html = documentTemplateService.renderTemplate(
      { ...TEMPLATE, contenu: '{{texte}}', variables: ['texte'] },
      { texte: `O\'Brien & <b>filial</b>` }
    );

    expect(html).toBe('O&#39;Brien &amp; &lt;b&gt;filial&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });

  test('renderTemplate remplace toutes les occurrences d\'une même variable', () => {
    const html = documentTemplateService.renderTemplate(
      { ...TEMPLATE, contenu: '{{stagiaire_nom}} puis {{stagiaire_nom}}' },
      { stagiaire_nom: 'Trabelsi' }
    );

    expect(html).toBe('Trabelsi puis Trabelsi');
  });

  test('renderTemplate renvoie le contenu inchangé quand il n\'y a aucune variable', () => {
    const contenu = 'Convention de stage — STEG, sans aucune accolade.';
    const html = documentTemplateService.renderTemplate({ ...TEMPLATE, contenu, variables: [] }, {});

    expect(html).toBe(contenu);
  });

  test('renderTemplate refuse une variable absente des données (422)', () => {
    expect(() =>
      documentTemplateService.renderTemplate(
        { ...TEMPLATE, contenu: 'Bonjour {{stagiaire_nom}}' },
        {}
      )
    ).toThrow(expect.objectContaining({ statusCode: 422 }));
  });

  test('renderTemplate refuse un contenu dont la variable n\'est pas déclarée (422)', () => {
    expect(() =>
      documentTemplateService.renderTemplate(
        { ...TEMPLATE, contenu: 'Bonjour {{entreprise_nom}}', variables: ['stagiaire_nom'] },
        { entreprise_nom: 'STEG', stagiaire_nom: 'X' }
      )
    ).toThrow(expect.objectContaining({ statusCode: 422 }));
  });

  test('renderTemplate refuse une valeur objet ou fonction (422)', () => {
    expect(() =>
      documentTemplateService.renderTemplate({ ...TEMPLATE, contenu: '{{stagiaire_nom}}' }, {
        stagiaire_nom: { nom: 'Trabelsi' }
      })
    ).toThrow(expect.objectContaining({ statusCode: 422 }));

    expect(() =>
      documentTemplateService.renderTemplate({ ...TEMPLATE, contenu: '{{stagiaire_nom}}' }, {
        stagiaire_nom: () => 'pwn'
      })
    ).toThrow(expect.objectContaining({ statusCode: 422 }));
  });

  test('renderTemplate refuse des données qui ne sont pas un objet (400)', () => {
    expect(() =>
      documentTemplateService.renderTemplate({ ...TEMPLATE }, 'pas-un-objet')
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  test('renderTemplate n\'interprète pas une valeur qui contient un placeholder', () => {
    const html = documentTemplateService.renderTemplate(
      { ...TEMPLATE, contenu: 'Valeur : {{stagiaire_nom}}' },
      { stagiaire_nom: '{{autre_variable}}' }
    );

    expect(html).toBe('Valeur : {{autre_variable}}');
  });

  test('renderTemplate accepte un nombre, un booléen et une date', () => {
    const html = documentTemplateService.renderTemplate(
      { ...TEMPLATE, contenu: '{{a}}/{{b}}/{{c}}', variables: ['a', 'b', 'c'] },
      { a: 12, b: false, c: new Date('2026-02-01T00:00:00.000Z') }
    );

    expect(html).toContain('12');
    expect(html).toContain('false');
    expect(html).toContain('2026');
  });
});

describe('DocumentTemplateService — aperçu', () => {
  test('previewTemplate renvoie le contenu rendu sans écrire en base', async () => {
    const preview = await documentTemplateService.previewTemplate(TEMPLATE.id, {
      stagiaire_nom: 'Ben Ali'
    });

    expect(preview).toBe('Bonjour Ben Ali');
    expect(documentTemplateRepository.findById).toHaveBeenCalledWith(TEMPLATE.id);
    expect(documentTemplateRepository.create).not.toHaveBeenCalled();
    expect(documentTemplateRepository.update).not.toHaveBeenCalled();
    expect(documentTemplateRepository.deactivate).not.toHaveBeenCalled();
  });

  test('previewTemplate renvoie 404 si le template n\'existe pas', async () => {
    documentTemplateRepository.findById.mockResolvedValue(null);

    await expect(
      documentTemplateService.previewTemplate('22222222-2222-4222-8222-222222222222', {})
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('previewTemplate refuse les données absentes (422)', async () => {
    await expect(
      documentTemplateService.previewTemplate(TEMPLATE.id, {})
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
