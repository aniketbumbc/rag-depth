import fs from 'node:fs/promises';
import { chunkMarkdown } from './md-chunk.js';

const file = './pdf/data-1.md';

const chunks = await chunkMarkdown(await fs.readFile(file, 'utf8'));

console.log(`${chunks.length} chunks\n`);
chunks.forEach((c, i) => {
  const preview = c.text.replace(/\s+/g, ' ').slice(0, 90);
  console.log(
    `#${i}  [p${c.page}]  ${c.headingPath}  (${c.text.length} chars)\n    ${preview}\n`,
  );
});
