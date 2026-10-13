import 'dotenv/config';
import { rerank } from 'ai';
import { cohere } from '@ai-sdk/cohere';

export async function rerankHits(question, candidates, topN = 10) {
  if (candidates.length === 0) return [];

  const { ranking } = await rerank({
    model: cohere.reranking('rerank-v3.5'),
    query: question,
    documents: candidates.map((c) => c.pageContent),
    topN,
  });

  return ranking.map((r) => ({
    ...candidates[r.originalIndex],
    score: r.score,
  }));
}
