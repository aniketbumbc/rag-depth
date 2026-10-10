import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chunkPdf } from './chuks.js'; // fix: loadFile and chunkPages do not exist; chunkPdf loads a PDF and returns its chunks
import { pool, toVec } from './db.js';
import { embedTexts, EMBED_MODEL } from './embed.js';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// 3. STORE: replace the whole document in one transaction
async function storeDocument(docId, tenantId, chunks) {
    const vectors = await embedTexts(chunks.map((c) => c.text)); // embed BEFORE touching the DB
  
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM chunksragpractice WHERE doc_id = $1 AND tenant_id = $2", [docId, tenantId]); // fix: table is chunksragpractice, same as db.js
  
      const BATCH = 50; // rows per INSERT
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const values = []; // fix: dropped the TypeScript `unknown[]` type so this file parses as JavaScript
        const placeholders = slice.map((c, j) => {
          const idx = i + j;
          const o = values.length;
          values.push(
            `${docId}:${idx}:${sha(c.text)}`,                 // id
            docId,
            tenantId,
            c.text,
            JSON.stringify({
              source: docId,
              page: c.page,
              documentType: c.documentType,
              startIndex: c.startIndex,
              endIndex: c.endIndex,
              tokenCount: c.tokenCount,
              chunkIndex: idx,
            }),
            toVec(vectors[idx]),
            EMBED_MODEL
          );
          return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5}::jsonb,$${o + 6}::vector,$${o + 7})`;
        });
  
        await client.query(
          // fix: table is chunksragpractice, same as the DELETE above and db.js
          `INSERT INTO chunksragpractice (id, doc_id, tenant_id, content, metadata, embedding, model)
           VALUES ${placeholders.join(",")}`,
          values
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }


  async function main() {
    const dir = process.argv[2] ?? "./docs";
    const tenantId = process.argv[3] ?? "acme";
  
    const files = (await fs.readdir(dir)).filter((f) => !f.startsWith("."));
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.pdf')) {
        console.log(`⚠️  ${file}: skipped, chunkPdf only reads PDFs`);
        continue;
      }
      // fix: chunkPdf replaces the missing loadFile + chunkPages calls
      const chunks = await chunkPdf(path.join(dir, file));
      if (!chunks.length) {
        console.log(`⚠️  ${file}: no text extracted (scanned PDF or unsupported type), skipped`);
        continue;
      }
      const pageCount = new Set(chunks.map((c) => c.page)).size; // fix: page count now comes from chunk metadata
      await storeDocument(file, tenantId, chunks);
      console.log(`✅ ${file}: ${pageCount} pages → ${chunks.length} chunks stored`);
    }
  }
  
  main()
    .catch((e) => {
      console.error("❌ Failed:", e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());