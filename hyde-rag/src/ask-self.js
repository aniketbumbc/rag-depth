import { pool } from '../../basic-rag/db.js';
import { selfRag } from './self-rag.js';

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Usage: pnpm ask:self "your question"');
  process.exit(1);
}

try {
  console.log('\n--- trace ---');
  const { answer, sources, path, useful } = await selfRag(question, {
    log: console.log,
  });

  console.log(
    `\nANSWER (${path}${useful === false ? ', may not fully answer' : ''}):\n${answer}\n`,
  );
  if (sources.length) {
    console.log('SOURCES:');
    sources.forEach((h, i) =>
      console.log(
        `[${i + 1}] ${h.metadata.headingPath} (p${h.metadata.page}) score=${Number(h.score).toFixed(3)}`,
      ),
    );
  }
} finally {
  await pool.end();
}
