// src/test-vector.ts
import crypto from 'crypto';
import { initVectorDb, upsertChunks, generateEmbedding, COLLECTION_NAME } from './services/vector.service.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const runVectorTest = async () => {
  try {
    console.log('--- [STEP 1] Initializing Qdrant Collection ---');
    await initVectorDb();

    console.log('\n--- [STEP 2] Upserting Sample Document Chunks ---');
    const testUserId = 'user_12345_placement_test';
    const testDocId = 'doc_99999_manual';

    const sampleChunks = [
      {
        id: crypto.randomUUID(),
        userId: testUserId,
        documentId: testDocId,
        content: 'The PostgreSQL database requires SSL connections when connecting from AWS EC2 instances in production.',
        chunkIndex: 0,
      },
      {
        id: crypto.randomUUID(),
        userId: testUserId,
        documentId: testDocId,
        content: 'Employees must submit their annual leave requests at least two weeks before the vacation date.',
        chunkIndex: 1,
      },
    ];

    await upsertChunks(sampleChunks);

    console.log('\n--- [STEP 3] Performing Semantic Vector Search ---');
    // We ask a question that doesn't use the exact words from Chunk 0, but has the same semantic meaning!
    const userQuestion = 'How do I securely connect to my relational database in the cloud?';
    console.log(`Query: "${userQuestion}"\n`);

    const queryVector = await generateEmbedding(userQuestion);

    // Search Qdrant with an RBAC filter ensuring we only search user_12345's data
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 2,
      filter: {
        must: [
          {
            key: 'userId',
            match: { value: testUserId },
          },
        ],
      },
    });

    console.log('--- SEARCH RESULTS (Ranked by Cosine Similarity) ---');
    searchResults.forEach((res, i) => {
      console.log(`\n[Rank #${i + 1}] Score: ${res.score.toFixed(4)}`);
      console.log(`Content: "${res.payload?.content}"`);
      console.log(`Document ID: ${res.payload?.documentId} | Chunk Index: ${res.payload?.chunkIndex}`);
    });

  } catch (error) {
    console.error('Vector Test Failed:', error);
  }
};

runVectorTest();