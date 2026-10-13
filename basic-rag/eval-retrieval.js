import fs from 'node:fs';
import { retrieve } from './retrieve.js';
import { hybridSearch } from './hybrid.js';
import { pool } from './db.js';

const golden = JSON.parse(fs.readFileSync('goldendata.json', 'utf8'));

const isMatch = (h, exp) =>
  h.metadata.source === exp.source &&
  (exp.page === undefined || Number(h.metadata.page) === exp.page);

const searchers = {
  vector: (q, k, minScore) => retrieve(q, { tenantId: 'acme', k, minScore }),
  hybrid: (q, k) => hybridSearch(q, { tenantId: 'acme', k }),
};

export async function evalRetrieval(k = 4, minScore = 0, mode = 'vector') {
  const items = golden.filter((g) => g.answerable);
  let recall = 0,
    mrr = 0,
    precision = 0;

  for (const g of items) {
    const hits = await searchers[mode](g.question, k, minScore);
    const relevant = hits.map((h) =>
      g.expectedSources.some((e) => isMatch(h, e)),
    );

    if (relevant.some(Boolean)) recall++;
    const firstRank = relevant.findIndex(Boolean);
    if (firstRank >= 0) mrr += 1 / (firstRank + 1);
    precision += relevant.filter(Boolean).length / Math.max(hits.length, 1);
  }

  const n = items.length;
  return {
    mode,
    k,
    recall: +(recall / n).toFixed(3),
    mrr: +(mrr / n).toFixed(3),
    precision: +(precision / n).toFixed(3),
  };
}

const rows = [];
for (const mode of Object.keys(searchers))
  for (const k of [1, 3, 5, 10]) rows.push(await evalRetrieval(k, 0, mode));
console.table(rows);
await pool.end();
