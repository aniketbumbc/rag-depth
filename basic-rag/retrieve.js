import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();

const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

export const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  tableName: 'chunksragpractice',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'embedding',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
  },
  distanceStrategy: 'cosine',
});

export async function retrieve(question, { k = 10 } = {}) {
  const results = await vectorStore.similaritySearch(question, k);
  //console.log(results);
  return results;
}
