require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || ''
});

const migrations = [
  `CREATE INDEX IF NOT EXISTS idx_stage_offre ON stage(offre_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tache_createur ON tache(createur_id)`,
  `CREATE INDEX IF NOT EXISTS idx_document_stage ON document(stage_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evaluation_encadrant ON evaluation(encadrant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_utilisateur_permission_permission ON utilisateur_permission(permission_id)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      console.log('Running:', sql.substring(0, 80) + '...');
      await client.query(sql);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
