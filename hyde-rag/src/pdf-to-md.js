import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const loaded = require('@opendocsg/pdf2md');
const pdf2md = loaded.default ?? loaded;

const CACHE_DIR = '.cache';

export async function pdfToMarkdown(
  pdfPath = './pdf/data-1.pdf',
  { refresh = false } = {},
) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(
    CACHE_DIR,
    path.basename(pdfPath).replace(/\.pdf$/i, '.md'),
  );

  // Reuse the cached Markdown if it is at least as new as the PDF
  if (!refresh) {
    try {
      const [pdfStat, mdStat] = await Promise.all([
        fs.stat(pdfPath),
        fs.stat(cachePath),
      ]);
      if (mdStat.mtimeMs >= pdfStat.mtimeMs)
        return await fs.readFile(cachePath, 'utf8');
    } catch {
      // no cache yet, so convert below
    }
  }

  const markdown = await pdf2md(await fs.readFile(pdfPath));
  await fs.writeFile(cachePath, markdown, 'utf8');
  return markdown;
}
