import { pool, toVec } from './db.js';
import { embedTexts } from './embed.js';

// Raw SQL instead of PGVectorStore so we get ids + cosine scores and can filter by tenant.
// Rows come back as { id, pageContent, metadata, score }, the same shape as keywordSearch.
export async function retrieve(
  question,
  { tenantId = 'acme', k = 10, minScore = 0 } = {},
) {
  const [vec] = await embedTexts([question]);

  const { rows } = await pool.query(
    `SELECT id, content AS "pageContent", metadata, 1 - (embedding <=> $1::vector) AS score
     FROM chunksragpractice
     WHERE tenant_id = $2 AND 1 - (embedding <=> $1::vector) >= $3
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    [toVec(vec), tenantId, minScore, k],
  );
  return rows;
}
