import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI(); // reads OPENAI_API_KEY from .env

export const EMBED_MODEL = 'text-embedding-3-small'; // 1536 dimensions, matches vector(1536)

export async function embedTexts(texts) {
  const out = [];

  // Send up to 100 texts per request
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);

    // Retry on rate limits and temporary server errors
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await openai.embeddings.create({
          model: EMBED_MODEL,
          input: batch,
        });
        out.push(...res.data.map((d) => d.embedding));
        break;
      } catch (e) {
        const retryable = [429, 500, 502, 503].includes(e?.status);
        if (attempt >= 4 || !retryable) throw e;
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      }
    }
  }
  return out;
}
