import fs from 'node:fs/promises';

const file = './pdf/data-1.md';

const lines = (await fs.readFile(file, 'utf8')).split('\n');

// 1. Heading outline, with the size of each section
const headings = [];
lines.forEach((line, i) => {
  const m = line.match(/^(#{1,6})\s+(.*)/);
  if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i });
});

console.log(`\n== OUTLINE (${headings.length} headings) ==`);
headings.forEach((h, idx) => {
  const end = headings[idx + 1]?.line ?? lines.length;
  const chars = lines
    .slice(h.line + 1, end)
    .join('\n')
    .trim().length;
  console.log(
    `${'  '.repeat(h.level - 1)}${h.text.slice(0, 70)}  [${chars} chars]`,
  );
});

// 2. Suspicious headings
console.log('\n== SUSPICIOUS HEADINGS ==');
const sus = headings.filter(
  (h) => h.text.length > 100 || /[.,;]$/.test(h.text),
);
if (!sus.length) console.log('none');
sus.forEach((h) => console.log(`line ${h.line + 1}: ${h.text.slice(0, 90)}`));

// 3. Empty sections (heading directly followed by another heading)
console.log('\n== EMPTY SECTIONS ==');
let empty = 0;
headings.forEach((h, idx) => {
  const end = headings[idx + 1]?.line ?? lines.length;
  if (
    lines
      .slice(h.line + 1, end)
      .join('')
      .trim().length < 20
  ) {
    empty++;
    if (empty <= 10) console.log(`line ${h.line + 1}: ${h.text.slice(0, 70)}`);
  }
});
console.log(`total empty: ${empty}`);

// 4. Repeated lines (likely page headers or footers)
console.log('\n== REPEATED LINES (3+ times) ==');
const counts = new Map();
for (const l of lines
  .map((x) => x.trim())
  .filter((x) => x.length > 3 && x.length < 120)) {
  const k = l.replace(/\d+/g, '#').toLowerCase();
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
const reps = [...counts.entries()]
  .filter(([, n]) => n >= 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);
if (!reps.length) console.log('none');
reps.forEach(([k, n]) => console.log(`${n}x  ${k.slice(0, 80)}`));

// 5. Basic stats
const sizes = headings
  .map((h, idx) => {
    const end = headings[idx + 1]?.line ?? lines.length;
    return lines
      .slice(h.line + 1, end)
      .join('\n')
      .trim().length;
  })
  .sort((a, b) => a - b);
console.log('\n== SECTION SIZES (chars) ==');
console.log(
  `median: ${sizes[Math.floor(sizes.length / 2)] ?? 0}, largest: ${sizes.at(-1) ?? 0}`,
);
