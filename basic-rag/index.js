import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI(); // reads OPENAI_API_KEY

export async function embedTexts(texts) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts, // array = one batched call
    // dimensions: 512,      // optional shortening (see section 4)
  });
  return res.data.map((d) => d.embedding);
}

const [vec] = await embedTexts(['What is the refund policy?']);
console.log(vec); // 1536 by default for text-embedding-3-small
