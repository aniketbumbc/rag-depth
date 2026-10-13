import { pool } from './db.js';

// Adds the full-text column keywordSearch needs. Generated, so existing and future rows fill themselves.
await pool.query(`
  ALTER TABLE chunksragpractice
    ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
`);
await pool.query(
  'CREATE INDEX IF NOT EXISTS chunksragpractice_fts_idx ON chunksragpractice USING gin (fts)',
);
console.log('✅ fts column + GIN index ready');
await pool.end();
