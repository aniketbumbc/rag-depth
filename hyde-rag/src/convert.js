//Convert one PDF to Markdown

import fs from 'node:fs/promises';
import path from 'node:path';
import pdf2md from '@opendocsg/pdf2md';

const pdfPath = './pdf/data-1.pdf';
const buffer = await fs.readFile(pdfPath);
const markdown = await pdf2md(buffer);

const outPath = pdfPath.replace(/\.pdf$/i, '.md');
await fs.writeFile(outPath, markdown, 'utf8');

console.log(`Saved: ${outPath}`);
console.log(`Characters: ${markdown.length}`);
console.log(`Headings found: ${(markdown.match(/^#{1,6}\s/gm) ?? []).length}`);
