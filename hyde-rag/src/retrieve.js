import { pool, toVec } from '../../basic-rag/db.js';
import { embedTexts } from './embed.js';

// Embed any text and find the nearest chunks
export async function searchByText(text, k = 5) {
  const [vec] = await embedTexts([text]);
  const { rows } = await pool.query(
    `SELECT id, content, metadata, 1 - (embedding <=> $1::vector) AS score
     FROM chunksragpractice
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [toVec(vec), k],
  );
  return rows;
}

// Reciprocal Rank Fusion: merge ranked lists using only ranks
function rrf(lists, k = 60) {
  const byId = new Map();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const e = byId.get(hit.id) ?? { ...hit, rrf: 0 };
      e.rrf += 1 / (k + rank + 1);
      byId.set(hit.id, e);
    });
  }
  return [...byId.values()].sort((a, b) => b.rrf - a.rrf);
}

export const retrievePlain = (question, k = 4) => searchByText(question, k);

// HyDE: search with the hypothetical passage AND the original question, then merge
export async function retrieveHyde(question, passage, k = 4) {
  const [byPassage, byQuestion] = await Promise.all([
    searchByText(passage, 10),
    searchByText(question, 10),
  ]);
  return rrf([byPassage, byQuestion]).slice(0, k);
}
