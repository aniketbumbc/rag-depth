import fs from 'node:fs';
import { answerQuestion } from './generate.js';
import { buildContext } from './utils.js';
import { faithfulness, relevancy, correctness } from './judge.js';

const golden = JSON.parse(fs.readFileSync('goldendata.json', 'utf8'));
const REFUSAL = "I don't know based on the provided documents.";

const isRefusal = (answer) => answer.includes("I don't know");

export async function evalGeneration() {
  const rows = [];

  for (const g of golden) {
    const { answer, sources } = await answerQuestion(g.question);
    const context = buildContext(sources);

    // Unanswerable questions have no reference: the correct behaviour is to refuse.
    const [f, r, c] = await Promise.all([
      faithfulness(context, answer),
      g.answerable
        ? relevancy(g.question, answer)
        : { score: isRefusal(answer) ? 1 : 0, reason: 'expected refusal' },
      g.answerable
        ? correctness(g.question, answer, g.referenceAnswer)
        : { score: isRefusal(answer) ? 1 : 0, reason: `expected: ${REFUSAL}` },
    ]);

    const row = {
      id: g.id,
      faithfulness: f.score,
      relevancy: r.score,
      correctness: c.score,
    };
    rows.push(row);
    console.log(row);
    if (f.unsupported_claims?.length)
      console.log('  unsupported:', f.unsupported_claims);
    if (c.score < 1) console.log('  correctness:', c.reason);
  }

  const avg = (key) =>
    +(rows.reduce((sum, row) => sum + row[key], 0) / rows.length).toFixed(3);

  return {
    n: rows.length,
    faithfulness: avg('faithfulness'),
    relevancy: avg('relevancy'),
    correctness: avg('correctness'),
  };
}

console.log('\nAVERAGES', await evalGeneration());
