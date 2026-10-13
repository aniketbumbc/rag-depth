import { hybridSearch } from './hybrid.js';
import { rerankHits } from './rerantk.js';

// Two-stage retrieval: cast a wide net with hybrid search, then let the
// cross-encoder reorder the candidates and keep the top k.
export async function retrieveRerank(question, opts = {}) {
  const { tenantId = 'acme', k = 4, fetchK = 20, candidates = 30 } = opts;

  const hits = await hybridSearch(question, {
    tenantId,
    k: candidates,
    fetchK,
  });
  return rerankHits(question, hits, k);
}
