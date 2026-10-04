const pool = require('../config/db');
const { DEFAULT_LIMIT } = require('../utils/pagination.util');

const TEMPLATE_COLUMNS =
  'id, nom, type, contenu, variables, actif, version, created_by, created_at, updated_at';
const GENERATED_COLUMNS =
  'id, template_id, template_version, stage_id, variables, chemin, created_at';

class DocumentTemplateRepository {
  async create(data) {
    const { nom, type, contenu, variables, actif, version, created_by } = data;
    const result = await pool.query(
      `INSERT INTO document_template (nom, type, contenu, variables, actif, version, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       RETURNING ${TEMPLATE_COLUMNS}`,
      [
        nom,
        type,
        contenu,
        JSON.stringify(variables == null ? [] : variables),
        actif === undefined ? true : actif,
        version === undefined ? 1 : version,
        created_by === undefined ? null : created_by
      ]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await pool.query(
      `SELECT ${TEMPLATE_COLUMNS} FROM document_template WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Filtres : type, actif, page, limit (+ offset/enabling hérités de
   * getPaginationParams). Paginé → { data, total } (le service applique
   * buildPaginatedResult) ; sinon → tableau de lignes.
   */
  async findAll(filters = {}) {
    const isPaginated =
      filters.enabled !== undefined
        ? Boolean(filters.enabled)
        : filters.page !== undefined || filters.limit !== undefined;

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.max(1, parseInt(filters.limit, 10) || DEFAULT_LIMIT);
    const offset =
      filters.offset !== undefined && filters.offset !== null && filters.offset !== ''
        ? Math.max(0, parseInt(filters.offset, 10) || 0)
        : (page - 1) * limit;

    const type = filters.type === undefined ? null : filters.type;
    const actif = filters.actif === undefined ? null : filters.actif;

    const where = `
      WHERE ($1::type_document IS NULL OR type = $1)
        AND ($2::boolean IS NULL OR actif = $2)`;

    const result = await pool.query(
      `SELECT ${TEMPLATE_COLUMNS} FROM document_template${where}
       ORDER BY type, version DESC
       ${isPaginated ? 'LIMIT $3 OFFSET $4' : ''}`,
      isPaginated ? [type, actif, limit, offset] : [type, actif]
    );

    if (!isPaginated) return result.rows;

    const countRes = await pool.query(
      `SELECT COUNT(*) AS total FROM document_template${where}`,
      [type, actif]
    );
    return { data: result.rows, total: parseInt(countRes.rows[0].total, 10) };
  }

  /**
   * Tous les templates ACTIFS du type, du plus récent au plus ancien (version
   * DESC). Plusieurs lignes possibles : le service choisit explicitement la
   * version et détecte l'anomalie « plusieurs versions actives ».
   */
  async findActiveByType(type) {
    const result = await pool.query(
      `SELECT ${TEMPLATE_COLUMNS} FROM document_template
       WHERE type = $1 AND actif = true
       ORDER BY version DESC`,
      [type]
    );
    return result.rows;
  }

  async findLatestByType(type) {
    const result = await pool.query(
      `SELECT ${TEMPLATE_COLUMNS} FROM document_template
       WHERE type = $1
       ORDER BY version DESC
       LIMIT 1`,
      [type]
    );
    return result.rows[0] || null;
  }

  async update(id, data) {
    const { nom, contenu, variables } = data;
    const result = await pool.query(
      `UPDATE document_template SET
         nom = COALESCE($1, nom),
         contenu = COALESCE($2, contenu),
         variables = COALESCE($3::jsonb, variables)
       WHERE id = $4
       RETURNING ${TEMPLATE_COLUMNS}`,
      [
        nom === undefined ? null : nom,
        contenu === undefined ? null : contenu,
        variables == null ? null : JSON.stringify(variables),
        id
      ]
    );
    return result.rows[0] || null;
  }

  async deactivate(id) {
    const result = await pool.query(
      `UPDATE document_template SET actif = false
       WHERE id = $1
       RETURNING ${TEMPLATE_COLUMNS}`,
      [id]
    );
    return result.rows[0] || null;
  }

  async createGenerated(data) {
    const { template_id, template_version, stage_id, variables, chemin } = data;
    const result = await pool.query(
      `INSERT INTO document_generated (template_id, template_version, stage_id, variables, chemin)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING ${GENERATED_COLUMNS}`,
      [
        template_id === undefined ? null : template_id,
        template_version,
        stage_id === undefined ? null : stage_id,
        JSON.stringify(variables == null ? {} : variables),
        chemin
      ]
    );
    return result.rows[0];
  }

  async findGeneratedById(id) {
    const result = await pool.query(
      `SELECT ${GENERATED_COLUMNS} FROM document_generated WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findGeneratedByStageId(stageId) {
    const result = await pool.query(
      `SELECT ${GENERATED_COLUMNS} FROM document_generated
       WHERE stage_id = $1
       ORDER BY created_at DESC, id DESC`,
      [stageId]
    );
    return result.rows;
  }
}

module.exports = new DocumentTemplateRepository();
