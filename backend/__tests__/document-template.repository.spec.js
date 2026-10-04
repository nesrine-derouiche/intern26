require('dotenv').config();
const pool = require('../config/db');
const documentTemplateRepository = require('../repositories/document-template.repository');

// Chaque exécution marque ses lignes avec un préfixe unique : le nettoyage ne
// touche que les données de cette suite, jamais celles d'une autre suite.
const RUN = `P1-3A2-${Date.now()}`;
const NOM_LIKE = `${RUN}%`;
const SUITE_NOM_LIKE = 'P1-3A2-%';
const CHEMIN_LIKE = 'p1-3a2-%';

let stageId = null;
let adminId = null;

const nom = (label) => `${RUN}-${label}`;
const chemin = (label) => `${CHEMIN_LIKE.replace('%', '')}${label}.pdf`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function nextVersion(type) {
  const res = await pool.query(
    'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM document_template WHERE type = $1',
    [type]
  );
  return parseInt(res.rows[0].v, 10);
}

async function createTemplate(data) {
  const version = data.version === undefined ? await nextVersion(data.type) : data.version;
  return documentTemplateRepository.create({ ...data, version });
}

async function cleanSuiteRows() {
  await pool.query(
    `DELETE FROM document_generated
      WHERE chemin LIKE $1
         OR template_id IN (SELECT id FROM document_template WHERE nom LIKE $2)`,
    [CHEMIN_LIKE, SUITE_NOM_LIKE]
  );
  await pool.query('DELETE FROM document_template WHERE nom LIKE $1', [SUITE_NOM_LIKE]);
}

beforeAll(async () => {
  await cleanSuiteRows();

  const stageRes = await pool.query('SELECT id FROM stage ORDER BY id LIMIT 1');
  if (!stageRes.rows[0]) {
    throw new Error('Précondition : aucune stage en base (exécuter le seed).');
  }
  stageId = stageRes.rows[0].id;

  const userRes = await pool.query(
    "SELECT id FROM utilisateur WHERE role = 'ADMIN' ORDER BY id LIMIT 1"
  );
  if (!userRes.rows[0]) {
    throw new Error('Précondition : aucun ADMIN en base (exécuter le seed).');
  }
  adminId = userRes.rows[0].id;
});

afterAll(async () => {
  await cleanSuiteRows();
  await pool.end();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DocumentTemplateRepository — templates', () => {
  test('create insère un template et renvoie la ligne complète', async () => {
    const created = await createTemplate({
      nom: nom('create'),
      type: 'CONVENTION',
      contenu: 'Bonjour {{stagiaire_nom}}'
    });

    expect(created.id).toBeTruthy();
    expect(created.nom).toBe(nom('create'));
    expect(created.type).toBe('CONVENTION');
    expect(created.contenu).toBe('Bonjour {{stagiaire_nom}}');
    expect(created.actif).toBe(true);
    expect(created.version).toBeGreaterThanOrEqual(1);
    expect(created.created_by).toBeNull();
    expect(created.variables).toEqual([]);
    expect(created.created_at).toBeInstanceOf(Date);
    expect(created.updated_at).toBeInstanceOf(Date);
  });

  test('create applique les défauts actif=true, version=1, variables=[]', async () => {
    const spy = jest.spyOn(pool, 'query').mockResolvedValue({ rows: [{ id: 'stub' }] });

    const created = await documentTemplateRepository.create({
      nom: 'defauts',
      type: 'CV',
      contenu: 'contenu'
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [sql, params] = spy.mock.calls[0];
    expect(sql).toContain('INSERT INTO document_template');
    expect(params).toEqual(['defauts', 'CV', 'contenu', '[]', true, 1, null]);
    expect(created).toEqual({ id: 'stub' });

    spy.mockRestore();
  });

  test('create persiste le tableau JSONB variables', async () => {
    const created = await createTemplate({
      nom: nom('variables-tableau'),
      type: 'CONVENTION',
      contenu: '{{stagiaire_nom}} {{date_debut}}',
      variables: ['stagiaire_nom', 'date_debut']
    });

    const found = await documentTemplateRepository.findById(created.id);
    expect(Array.isArray(found.variables)).toBe(true);
    expect(found.variables).toEqual(['stagiaire_nom', 'date_debut']);
  });

  test('create respecte actif=false, version explicite et la FK created_by', async () => {
    const version = await nextVersion('ATTESTATION');
    const created = await createTemplate({
      nom: nom('actif-false'),
      type: 'ATTESTATION',
      contenu: 'Contenu',
      actif: false,
      version,
      created_by: adminId
    });

    expect(created.actif).toBe(false);
    expect(created.version).toBe(version);
    expect(created.created_by).toBe(adminId);
  });

  test('findById retourne le template créé', async () => {
    const created = await createTemplate({
      nom: nom('find-by-id'),
      type: 'CV',
      contenu: 'CV de {{stagiaire_nom}}'
    });

    const found = await documentTemplateRepository.findById(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.nom).toBe(nom('find-by-id'));
    expect(found.contenu).toBe('CV de {{stagiaire_nom}}');
  });

  test('findById retourne null pour un id inexistant', async () => {
    const found = await documentTemplateRepository.findById(
      '00000000-0000-4000-8000-000000000000'
    );
    expect(found).toBeNull();
  });

  test('findAll sans filtre retourne un tableau contenant le template créé', async () => {
    const created = await createTemplate({
      nom: nom('find-all'),
      type: 'RAPPORT',
      contenu: 'Rapport'
    });

    const rows = await documentTemplateRepository.findAll();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((r) => r.id === created.id)).toBe(true);
  });

  test('findAll filtre sur type', async () => {
    const created = await createTemplate({
      nom: nom('find-all-type'),
      type: 'ASSURANCE',
      contenu: 'Assurance'
    });

    const rows = await documentTemplateRepository.findAll({ type: 'ASSURANCE' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.type === 'ASSURANCE')).toBe(true);
    expect(rows.some((r) => r.id === created.id)).toBe(true);
  });

  test('findAll filtre sur actif', async () => {
    const inactive = await createTemplate({
      nom: nom('find-all-inactif'),
      type: 'ATTESTATION',
      contenu: 'Inactif',
      actif: false
    });

    const actives = await documentTemplateRepository.findAll({ actif: true });
    expect(actives.length).toBeGreaterThan(0);
    expect(actives.every((r) => r.actif === true)).toBe(true);

    const inactives = await documentTemplateRepository.findAll({ actif: false });
    expect(inactives.every((r) => r.actif === false)).toBe(true);
    expect(inactives.some((r) => r.id === inactive.id)).toBe(true);
  });

  test('findAll paginé retourne { data, total } avec data limité à limit', async () => {
    for (const label of ['page-a', 'page-b', 'page-c']) {
      await createTemplate({ nom: nom(label), type: 'CV', contenu: label });
    }

    const result = await documentTemplateRepository.findAll({ page: 1, limit: 2 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBe(2);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(3);
  });

  test('findAll paginé : la page 2 ne répète pas la page 1', async () => {
    const page1 = await documentTemplateRepository.findAll({ page: 1, limit: 3 });
    const page2 = await documentTemplateRepository.findAll({ page: 2, limit: 3 });

    const ids1 = page1.data.map((r) => r.id);
    const ids2 = page2.data.map((r) => r.id);
    expect(ids1.length).toBe(3);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  test('findAll paginé respecte type + actif combinés à la pagination', async () => {
    const created = await createTemplate({
      nom: nom('find-all-coupe'),
      type: 'RAPPORT',
      contenu: 'Coupe',
      actif: true
    });

    const result = await documentTemplateRepository.findAll({
      type: 'RAPPORT',
      actif: true,
      page: 1,
      limit: 5
    });
    expect(result.data.every((r) => r.type === 'RAPPORT' && r.actif === true)).toBe(true);
    expect(result.data.some((r) => r.id === created.id)).toBe(true);
  });

  test('findActiveByType retourne les templates actifs du type, triés version DESC', async () => {
    await createTemplate({ nom: nom('active-1'), type: 'CONVENTION', contenu: 'v1' });
    const v2 = await createTemplate({ nom: nom('active-2'), type: 'CONVENTION', contenu: 'v2' });

    const rows = await documentTemplateRepository.findActiveByType('CONVENTION');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.type === 'CONVENTION' && r.actif === true)).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].version).toBeGreaterThanOrEqual(rows[i].version);
    }
    expect(rows.some((r) => r.id === v2.id)).toBe(true);
  });

  test('findActiveByType ne masque pas plusieurs versions actives', async () => {
    const version = await nextVersion('ASSURANCE');
    const first = await createTemplate({
      nom: nom('multi-1'),
      type: 'ASSURANCE',
      contenu: 'a1',
      version
    });
    const second = await createTemplate({
      nom: nom('multi-2'),
      type: 'ASSURANCE',
      contenu: 'a2',
      version: version + 1
    });

    const rows = await documentTemplateRepository.findActiveByType('ASSURANCE');
    const mine = rows.filter((r) => r.id === first.id || r.id === second.id);
    expect(mine.length).toBe(2);
    expect(rows[0].version).toBeGreaterThanOrEqual(rows[rows.length - 1].version);
  });

  test('findActiveByType ignore les templates désactivés', async () => {
    const inactive = await createTemplate({
      nom: nom('active-ignore'),
      type: 'ATTESTATION',
      contenu: 'inactif',
      actif: false
    });

    const rows = await documentTemplateRepository.findActiveByType('ATTESTATION');
    expect(rows.every((r) => r.id !== inactive.id)).toBe(true);
  });

  test('findLatestByType retourne la version la plus récente', async () => {
    const version = await nextVersion('RAPPORT');
    await createTemplate({
      nom: nom('latest-old'),
      type: 'RAPPORT',
      contenu: 'ancien',
      version
    });
    const latest = await createTemplate({
      nom: nom('latest-new'),
      type: 'RAPPORT',
      contenu: 'récent',
      version: version + 1
    });

    const found = await documentTemplateRepository.findLatestByType('RAPPORT');
    expect(found).not.toBeNull();
    expect(found.id).toBe(latest.id);
    expect(found.version).toBe(version + 1);
  });

  test('update modifie nom, contenu et variables sans toucher à version/type', async () => {
    const created = await createTemplate({
      nom: nom('update'),
      type: 'CONVENTION',
      contenu: 'ancien contenu',
      variables: ['ancienne_variable']
    });

    const updated = await documentTemplateRepository.update(created.id, {
      nom: nom('update-modifie'),
      contenu: 'nouveau contenu',
      variables: ['nouvelle_variable']
    });

    expect(updated.id).toBe(created.id);
    expect(updated.nom).toBe(nom('update-modifie'));
    expect(updated.contenu).toBe('nouveau contenu');
    expect(updated.variables).toEqual(['nouvelle_variable']);
    expect(updated.version).toBe(created.version);
    expect(updated.type).toBe(created.type);
    expect(updated.actif).toBe(created.actif);
    expect(updated.updated_at.getTime()).toBeGreaterThanOrEqual(created.updated_at.getTime());
  });

  test('update avec des champs absents conserve les valeurs existantes', async () => {
    const created = await createTemplate({
      nom: nom('update-partiel'),
      type: 'CV',
      contenu: 'contenu initial',
      variables: ['v1']
    });

    const updated = await documentTemplateRepository.update(created.id, {
      nom: nom('update-partiel-2')
    });

    expect(updated.nom).toBe(nom('update-partiel-2'));
    expect(updated.contenu).toBe('contenu initial');
    expect(updated.variables).toEqual(['v1']);
  });

  test('update retourne null pour un id inexistant', async () => {
    const updated = await documentTemplateRepository.update(
      '00000000-0000-4000-8000-000000000000',
      { nom: 'inexistant' }
    );
    expect(updated).toBeNull();
  });

  test('deactivate passe actif à false sans supprimer la ligne', async () => {
    const created = await createTemplate({
      nom: nom('deactivate'),
      type: 'ATTESTATION',
      contenu: 'à désactiver'
    });

    const deactivated = await documentTemplateRepository.deactivate(created.id);
    expect(deactivated.actif).toBe(false);

    const found = await documentTemplateRepository.findById(created.id);
    expect(found).not.toBeNull();
    expect(found.actif).toBe(false);
  });

  test('deactivate retourne null pour un id inexistant', async () => {
    const result = await documentTemplateRepository.deactivate(
      '00000000-0000-4000-8000-000000000000'
    );
    expect(result).toBeNull();
  });
});

describe('DocumentTemplateRepository — historique de génération', () => {
  let templateId = null;

  beforeAll(async () => {
    const created = await createTemplate({
      nom: nom('generations'),
      type: 'CONVENTION',
      contenu: 'Convention de {{stagiaire_nom}}'
    });
    templateId = created.id;
  });

  test('createGenerated insère une génération avec variables JSONB objet', async () => {
    const generated = await documentTemplateRepository.createGenerated({
      template_id: templateId,
      template_version: 1,
      stage_id: stageId,
      variables: { stagiaire_nom: 'Trabelsi', date_debut: '2026-02-01' },
      chemin: chemin('obj')
    });

    expect(generated.id).toBeTruthy();
    expect(generated.template_id).toBe(templateId);
    expect(generated.template_version).toBe(1);
    expect(generated.stage_id).toBe(stageId);
    expect(generated.variables).toEqual({
      stagiaire_nom: 'Trabelsi',
      date_debut: '2026-02-01'
    });
    expect(generated.chemin).toContain('p1-3a2-');
    expect(generated.created_at).toBeInstanceOf(Date);
  });

  test('createGenerated accepte template_id null (template supprimé)', async () => {
    const generated = await documentTemplateRepository.createGenerated({
      template_id: null,
      template_version: 3,
      stage_id: stageId,
      variables: {},
      chemin: chemin('orphan')
    });

    expect(generated.template_id).toBeNull();
    expect(generated.template_version).toBe(3);
  });

  test('findGeneratedById retourne la génération, null si inconnue', async () => {
    const created = await documentTemplateRepository.createGenerated({
      template_id: templateId,
      template_version: 1,
      stage_id: stageId,
      variables: { x: 1 },
      chemin: chemin('by-id')
    });

    const found = await documentTemplateRepository.findGeneratedById(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.variables).toEqual({ x: 1 });

    const missing = await documentTemplateRepository.findGeneratedById(
      '00000000-0000-4000-8000-000000000000'
    );
    expect(missing).toBeNull();
  });

  test('findGeneratedByStageId retourne les générations du stage, triées created_at DESC', async () => {
    const first = await documentTemplateRepository.createGenerated({
      template_id: templateId,
      template_version: 1,
      stage_id: stageId,
      variables: { ordre: 1 },
      chemin: chemin('order-1')
    });
    await delay(20);
    const second = await documentTemplateRepository.createGenerated({
      template_id: templateId,
      template_version: 1,
      stage_id: stageId,
      variables: { ordre: 2 },
      chemin: chemin('order-2')
    });

    const rows = await documentTemplateRepository.findGeneratedByStageId(stageId);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.stage_id === stageId)).toBe(true);

    const firstIndex = rows.findIndex((r) => r.id === first.id);
    const secondIndex = rows.findIndex((r) => r.id === second.id);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeLessThan(firstIndex);
  });

  test('findGeneratedByStageId retourne un tableau vide pour un stage sans génération', async () => {
    const rows = await documentTemplateRepository.findGeneratedByStageId(
      '00000000-0000-4000-8000-000000000000'
    );
    expect(rows).toEqual([]);
  });
});

describe('DocumentTemplateRepository — contraintes SQL', () => {
  test('la contrainte UNIQUE(type, version) est violée en doublon', async () => {
    const type = 'CONVENTION';
    const version = await nextVersion(type);

    await createTemplate({ nom: nom('unique-1'), type, contenu: 'premier', version });

    await expect(
      documentTemplateRepository.create({
        nom: nom('unique-2'),
        type,
        contenu: 'doublon',
        version
      })
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('la contrainte CHECK version >= 1 rejette version = 0', async () => {
    await expect(
      documentTemplateRepository.create({
        nom: nom('check-version'),
        type: 'CV',
        contenu: 'version invalide',
        version: 0
      })
    ).rejects.toMatchObject({ code: '23514' });
  });

  test("l'erreur PostgreSQL remonte brute (code + constraint), sans message métier", async () => {
    const type = 'CV';
    const version = await nextVersion(type);

    await createTemplate({ nom: nom('brut-1'), type, contenu: 'premier', version });

    const error = await documentTemplateRepository
      .create({ nom: nom('brut-2'), type, contenu: 'doublon', version })
      .then(() => null)
      .catch((err) => err);

    expect(error).not.toBeNull();
    expect(error.code).toBe('23505');
    expect(error.constraint).toBe('document_template_type_version_key');
    expect(typeof error.detail).toBe('string');
  });
});
