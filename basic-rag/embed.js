import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI();
export const EMBED_MODEL = 'text-embedding-3-small'; // 1536 dims, matches vector(1536)

// What this do
// It does this by waiting for 2^i * 500 + Math.random() * 250 milliseconds
// and then retrying the function.
// It does this up to 5 times.
// It throws an error if the function fails after 5 retries.
// It returns the result of the function.
// It is used to retry the function if it fails.
// It is used to retry the function if it fails.

async function withRetry(fn, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = [429, 500, 502, 503].includes(e?.status);
      if (!retryable || i >= tries - 1) throw e;
      await new Promise((r) =>
        setTimeout(r, 2 ** i * 500 + Math.random() * 250),
      );
    }
  }
}
/**
 * This function is used to embed the text using the openai embeddings model.
 * It does this by waiting for 2^i * 500 + Math.random() * 250 milliseconds
 * and then retrying the function.
 * It does this up to 5 times.
 * It throws an error if the function fails after 5 retries.
 * It returns the result of the function.
 * It is used to retry the function if it fails.
 * It is used to retry the function if it fails.
 */
export async function embedTexts(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await withRetry(() =>
      openai.embeddings.create({ model: EMBED_MODEL, input: batch }),
    );
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}
