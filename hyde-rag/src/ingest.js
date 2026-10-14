import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pool, toVec } from '../../basic-rag/db.js';
import { embedTexts, EMBED_MODEL } from './embed.js';
import { chunkMarkdown } from './md-chunk.js';
import { pdfToMarkdown } from './pdf-to-md.js';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

async function storeDocument(docId, markdown, tenantId = 'acme') {
  const chunks = await chunkMarkdown(markdown);
  if (!chunks.length) {
    console.log(
      `${docId}: no chunks produced (scanned PDF or empty text), skipped`,
    );
    return;
  }

  // Embed BEFORE touching the DB, so an API failure can't leave half-updated data
  const vectors = await embedTexts(chunks.map((c) => c.embedText));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Replace the whole document: no duplicates, no stale chunks
    await client.query(
      'DELETE FROM chunksragpractice WHERE doc_id = $1 AND tenant_id = $2',
      [docId, tenantId],
    );

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      await client.query(
        `INSERT INTO chunksragpractice (id, doc_id, tenant_id, content, metadata, embedding, model)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::vector,$7)`,
        [
          `${docId}:${i}:${sha(c.embedText)}`,
          docId,
          tenantId,
          c.embedText,
          JSON.stringify({
            source: docId,
            headingPath: c.headingPath,
            page: c.page,
            chunkIndex: i,
          }),
          toVec(vectors[i]),
          EMBED_MODEL,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(`${docId}: ${chunks.length} chunks stored`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const dir = args.find((a) => !a.startsWith('--')) ?? './pdf';

  const files = (await fs.readdir(dir)).filter((f) => !f.startsWith('.'));
  const pdfs = new Set(
    files.filter((f) => /\.pdf$/i.test(f)).map((f) => f.replace(/\.pdf$/i, '')),
  );

  for (const file of files) {
    const full = path.join(dir, file);

    if (/\.pdf$/i.test(file)) {
      await storeDocument(file, await pdfToMarkdown(full, { refresh }));
    } else if (/\.md$/i.test(file) && !pdfs.has(file.replace(/\.md$/i, ''))) {
      await storeDocument(file, await fs.readFile(full, 'utf8'));
    }
  }
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
