import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { SemanticChunker } from '@chonkiejs/core';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();

const loader = new PDFLoader('./pdf/data-1.pdf');
const docs = await loader.load();
const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

// how to add page number into metadata of the document starting from 1

let page = 1;
docs.forEach((doc) => {
  doc.metadata.page = page++;
});

docs.forEach((doc) => {
  if (doc.metadata.page % 2 === 0) {
    doc.metadata.documentType = 'traveller';
  } else {
    doc.metadata.documentType = 'admin';
  }
});

/**
 * `text-embedding-3-small` only decides the split points. It does not store vectors on the chunks.

For each page it does this:

1. Take 3 sentences as one window, and the single sentence right after that window.
2. Turn both into vectors with `embedDocuments`.
3. Compare those vectors with cosine similarity.
4. If the score drops below `0.7`, that is a topic change, so a new chunk starts there.
5. If the score stays high, those sentences stay in the same chunk.

The 512-character limit is separate. That split does not use the embedding model.
 */
const chunker = await SemanticChunker.create({
  embeddings: (texts) => embeddings.embedDocuments(texts),
  threshold: 0.7, // lower => larger groups, higher => smaller, tighter groups
  chunkSize: 512, // max tokens per chunk
  similarityWindow: 3,
  skipWindow: 0, // set 1+ to merge non-consecutive similar groups
});

const chunksByPage = await chunker.chunkBatch(
  docs.map((doc) => doc.pageContent),
);

const chunks = chunksByPage.flatMap((pageChunks, index) => {
  const { page, documentType } = docs[index].metadata;
  return pageChunks.map((chunk) => ({
    text: chunk.text,
    startIndex: chunk.startIndex,
    endIndex: chunk.endIndex,
    tokenCount: chunk.tokenCount,
    page,
    documentType,
  }));
});

//console.log('Total chunks', chunks);

for (const c of chunks) {
  console.log(c.tokenCount, c.text.slice(0, 60));
}

console.log('Total chunks', chunks.length);
