import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { SemanticChunker } from '@chonkiejs/core';
import { OpenAIEmbeddings } from '@langchain/openai';
import 'dotenv/config';

export async function chunkPdf(path) {
  const loader = new PDFLoader(path);
  const docs = await loader.load();
  const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });

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

  const chunker = await SemanticChunker.create({
    embeddings: (texts) => embeddings.embedDocuments(texts),
    threshold: 0.7, // lower => larger groups, higher => smaller, tighter groups
    chunkSize: 512, // max characters per chunk (character tokenizer)
    similarityWindow: 3,
    skipWindow: 0, // set 1+ to merge non-consecutive similar groups
  });

  const chunksByPage = await chunker.chunkBatch(
    docs.map((doc) => doc.pageContent),
  );

  return chunksByPage.flatMap((pageChunks, index) => {
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
}
