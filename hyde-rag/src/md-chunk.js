import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// Headings that are page furniture, not real sections.
// The heading line is removed, but its text stays with the previous section.
const JUNK_HEADINGS = [/^contd\.*$/i, /^subscribe\b/i];

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1200,
  chunkOverlap: 120,
});

const cleanTitle = (t) =>
  t
    .replace(/^[*\-•\s]+/, '')
    .replace(/[\s:.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

// 1. Parse into flat sections (heading levels are ignored, since this PDF's levels are meaningless)
export function parseSections(markdown) {
  const sections = [];
  let page = 1;
  let current = { title: 'Document', page: 1, lines: [] };

  const push = () =>
    sections.push({
      title: current.title,
      page: current.page,
      text: current.lines.join('\n').trim(),
    });

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();

    if (/^\s*<!--\s*page_break\s*-->\s*$/i.test(line)) {
      page++;
      continue;
    }

    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (m) {
      const title = cleanTitle(m[1]);
      if (!title || JUNK_HEADINGS.some((re) => re.test(title))) continue;
      push();
      current = { title, page, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  push();

  // drop an empty untitled preamble
  return sections.filter((s) => !(s.title === 'Document' && !s.text));
}

// 2. An empty heading is merged with the next one ("Day-02 / Day-03")
export function mergeEmptyHeadings(sections, minBody = 20) {
  const out = [];
  let carry = null;

  for (const s of sections) {
    const cur = carry
      ? {
          title: `${carry.title} / ${s.title}`,
          page: carry.page,
          text: [carry.text, s.text].filter(Boolean).join('\n'),
        }
      : s;
    carry = null;

    if (cur.text.length < minBody) carry = cur;
    else out.push(cur);
  }
  if (carry && carry.text) out.push(carry); // trailing leftover that still has some text
  return out;
}

// 3. Tiny sections are folded into the previous one (the title stays visible in the text)
export function mergeTiny(sections, minChars = 200) {
  const out = [];
  for (const s of sections) {
    const prev = out[out.length - 1];
    if (prev && s.text.length < minChars) {
      prev.text += `\n\n${s.title}\n${s.text}`;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

// 4. Split oversized sections, then build the text that gets embedded
export async function toChunks(sections, maxChars = 1500) {
  const chunks = [];
  for (const s of sections) {
    const parts =
      s.text.length > maxChars ? await splitter.splitText(s.text) : [s.text];
    for (const part of parts) {
      chunks.push({
        headingPath: s.title, // same field name your ingest code already uses
        page: s.page,
        text: part,
        embedText: `${s.title}\n\n${part}`, // the heading goes into the vector
      });
    }
  }

  return chunks;
}

export async function chunkMarkdown(markdown) {
  const sections = mergeTiny(mergeEmptyHeadings(parseSections(markdown)));
  return toChunks(sections);
}
