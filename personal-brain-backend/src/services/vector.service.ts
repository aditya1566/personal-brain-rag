// src/services/vector.service.ts
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export const COLLECTION_NAME = 'personal_brain_chunks';
const EMBEDDING_DIMENSION = 768;

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function initVectorDb() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`[VECTOR DB] Creating collection '${COLLECTION_NAME}'...`);
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: 'Cosine',
        },
      });
    }

    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'userId',
      field_schema: 'keyword',
    });

    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'childContent',
      field_schema: 'text',
    });
  } catch (error) {
    console.error('[VECTOR DB] Initialization error:', error);
  }
}

export interface RawDocument {
  documentId: string;
  userId: string;
  rawText: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Parent-Child Ingestion Pipeline
export async function processAndIngestDocument(doc: RawDocument) {
  // 1. Split into large Parent Chunks (~1000 characters)
  const parentSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  const parentDocs = await parentSplitter.createDocuments([doc.rawText]);

  // 2. Split each Parent into small Child Chunks (~200 characters)
  const childSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 200,
    chunkOverlap: 20,
  });

  const pointsToUpsert = [];

  for (let pIndex = 0; pIndex < parentDocs.length; pIndex++) {
    const parentContent = parentDocs[pIndex].pageContent;
    const parentId = `${doc.documentId}_parent_${pIndex}`;

    const childDocs = await childSplitter.createDocuments([parentContent]);

    for (let cIndex = 0; cIndex < childDocs.length; cIndex++) {
      const childContent = childDocs[cIndex].pageContent;
      const childId = `${doc.documentId}_p${pIndex}_c${cIndex}`;

      // Generate embedding ONLY for the small child chunk
      const vector = await generateEmbedding(childContent);

      // Throttling: Pause 300ms between calls to stay under Gemini free-tier limits (100 req/min)
      await sleep(300);

      pointsToUpsert.push({
        id: crypto.randomUUID(),
        vector,
        payload: {
          userId: doc.userId,
          documentId: doc.documentId,
          parentId,
          parentContent, // Store full parent context inside child payload!
          childContent,
        },
      });
    }
  }

  // 3. Upsert all generated points to Qdrant Vector Store
  if (pointsToUpsert.length > 0) {
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: pointsToUpsert,
    });
  }

  console.log(
    `[VECTOR DB] Ingested document '${doc.documentId}': Created ${parentDocs.length} parents & ${pointsToUpsert.length} child vectors.`
  );
}