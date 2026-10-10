import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL; remove if it errors on your setup
});

// pgvector accepts the text format "[0.1,0.2,...]"
export const toVec = (v) => `[${v.join(',')}]`;

// Random unit vector, only for testing
function fakeVector(dim = 1536) {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  // 1. Basic connectivity
  const now = await pool.query('SELECT now() AS now');
  console.log('✅ Connected:', now.rows[0].now);

  // 2. Extension check
  const ext = await pool.query(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  if (ext.rowCount === 0) throw new Error('pgvector is not enabled');
  console.log('✅ pgvector version:', ext.rows[0].extversion);

  // 3. Insert test rows
  const target = fakeVector();
  const rows = [
    { id: 'test:0', content: 'Target row (should rank first)', vec: target },
    { id: 'test:1', content: 'Random row A', vec: fakeVector() },
    { id: 'test:2', content: 'Random row B', vec: fakeVector() },
  ];

  for (const r of rows) {
    await pool.query(
      `INSERT INTO chunksragpractice (id, doc_id, tenant_id, content, metadata, embedding, model)
       VALUES ($1, 'test-doc', 'acme', $2, '{}', $3::vector, 'fake')
       ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
      [r.id, r.content, toVec(r.vec)],
    );
  }
  console.log('✅ Inserted', rows.length, 'rows');

  // 4. Search with the target vector: the target row must come back first
  const { rows: hits } = await pool.query(
    `SELECT id, content, 1 - (embedding <=> $1::vector) AS score
     FROM chunksragpractice
     WHERE tenant_id = 'acme' AND doc_id = 'test-doc'
     ORDER BY embedding <=> $1::vector
     LIMIT 3`,
    [toVec(target)],
  );
  console.table(hits);

  if (hits[0].id !== 'test:0')
    throw new Error('Search returned the wrong top result');
  console.log('✅ Vector search works (top score should be ~1.0)');

  // 5. Clean up test data
  await pool.query("DELETE FROM chunksragpractice WHERE doc_id = 'test-doc'");
  console.log('🧹 Test rows deleted');
}

// fix: run the test only when executing db.js directly.
// ingest.js imports pool from here, and that import must not run the test or close the pool.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((e) => {
      console.error('❌ Failed:', e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
