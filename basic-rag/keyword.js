import { pool } from './db.js';

// Turn a free-text question into an OR query: "refund | damaged | items"
function toOrQuery(q) {
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip punctuation and tsquery operators
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return [...new Set(words)].join(' | ');
}

export async function keywordSearch(question, opts) {
  const { tenantId = 'acme', k = 20 } = opts;
  const q = toOrQuery(question);
  if (!q) return [];

  // same row shape as retrieve(): { id, pageContent, metadata, score }
  const { rows } = await pool.query(
    `SELECT id, content AS "pageContent", metadata, ts_rank_cd(fts, query) AS score
     FROM chunksragpractice, to_tsquery('english', $1) query
     WHERE tenant_id = $2 AND fts @@ query
     ORDER BY score DESC
     LIMIT $3`,
    [q, tenantId, k],
  );
  return rows;
}
