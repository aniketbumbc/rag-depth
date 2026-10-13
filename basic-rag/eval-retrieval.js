import fs from 'node:fs';
import { retrieve } from './retrieve.js';
import { hybridSearch } from './hybrid.js';
import { rerankHits } from './rerantk.js';
import { pool } from './db.js';

const golden = JSON.parse(fs.readFileSync('goldendata.json', 'utf8'));
const KS = [1, 3, 5, 10];

const isMatch = (h, exp) =>
  h.metadata.source === exp.source &&
  (exp.page === undefined || Number(h.metadata.page) === exp.page);

const searchers = {
  vector: (q, k, minScore) => retrieve(q, { tenantId: 'acme', k, minScore }),
  hybrid: (q, k) => hybridSearch(q, { tenantId: 'acme', k }),
};

// Accumulates recall / mrr / precision over questions, then averages.
function scorer(mode, k) {
  let recall = 0,
    mrr = 0,
    precision = 0,
    n = 0;

  return {
    add(hits, g) {
      const relevant = hits.map((h) =>
        g.expectedSources.some((e) => isMatch(h, e)),
      );
      if (relevant.some(Boolean)) recall++;
      const firstRank = relevant.findIndex(Boolean);
      if (firstRank >= 0) mrr += 1 / (firstRank + 1);
      precision += relevant.filter(Boolean).length / Math.max(hits.length, 1);
      n++;
    },
    result: () => ({
      mode,
      k,
      recall: +(recall / n).toFixed(3),
      mrr: +(mrr / n).toFixed(3),
      precision: +(precision / n).toFixed(3),
    }),
  };
}

export async function evalRetrieval(k = 4, minScore = 0, mode = 'vector') {
  const s = scorer(mode, k);
  for (const g of golden.filter((g) => g.answerable))
    s.add(await searchers[mode](g.question, k, minScore), g);
  return s.result();
}

// Cohere trial keys allow 10 calls/minute, so space rerank calls >= 6.5s apart.
const RERANK_GAP_MS = 6500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rerank once per question (one Cohere call), then score every k from that ranking.
export async function evalRerank(ks = KS, fetchK = 20) {
  const scorers = ks.map((k) => scorer('rerank', k));
  let lastCall = 0;

  for (const g of golden.filter((g) => g.answerable)) {
    const candidates = await retrieve(g.question, {
      tenantId: 'acme',
      k: fetchK,
      minScore: 0,
    });
    await sleep(Math.max(0, lastCall + RERANK_GAP_MS - Date.now()));
    lastCall = Date.now();
    const ranked = await rerankHits(g.question, candidates, Math.max(...ks));
    ks.forEach((k, i) => scorers[i].add(ranked.slice(0, k), g));
  }
  return scorers.map((s) => s.result());
}

const rows = [];
for (const mode of Object.keys(searchers))
  for (const k of KS) rows.push(await evalRetrieval(k, 0, mode));
rows.push(...(await evalRerank()));
console.table(rows);
await pool.end();
