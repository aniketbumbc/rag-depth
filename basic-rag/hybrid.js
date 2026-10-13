import { retrieve } from './retrieve.js';
import { keywordSearch } from './keyword.js';

export function rrf(lists, k = 60) {
  const byId = new Map();

  lists.forEach((list, i) => {
    list.forEach((hit, rank) => {
      const entry = byId.get(hit.id) ?? { ...hit, scores: [], rrf: 0 };
      entry.rrf += 1 / (k + rank + 1);
      entry.scores[i] = hit.score; // raw score per list (cosine, ts_rank) for debugging/thresholds
      byId.set(hit.id, entry);
    });
  });
  return [...byId.values()].sort((a, b) => b.rrf - a.rrf);
}

export async function hybridSearch(question, opts) {
  const { tenantId, k = 4, fetchK = 20 } = opts;

  const [vec, kw] = await Promise.all([
    retrieve(question, { tenantId, k: fetchK, minScore: 0 }), // no threshold here
    keywordSearch(question, { tenantId, k: fetchK }),
  ]);

  return rrf([vec, kw]).slice(0, k);
}
