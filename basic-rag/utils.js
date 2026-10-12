// context.ts

export function buildContext(hits) {
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] (source: ${h.metadata.source}, page: ${h.metadata.page ?? 'n/a'})\n${h.pageContent}`,
    )
    .join('\n\n---\n\n');
}

export function resolveCitations(answer, sources) {
  const used = new Set(
    [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  return [...used]
    .filter((n) => n >= 1 && n <= sources.length)
    .map((n) => ({
      n,
      source: sources[n - 1].metadata.source,
      page: sources[n - 1].metadata.page,
      snippet: sources[n - 1].pageContent.slice(0, 160),
    }));
}
