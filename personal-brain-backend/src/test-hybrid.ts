// src/test-hybrid.ts
import dotenv from 'dotenv';
import { initVectorDb, upsertChunks } from './services/vector.service.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api/chat';

async function testHybridSearch() {
  console.log('--- [STEP 1] Seeding Hybrid Data (Exact Code / Part Numbers) ---');
  await initVectorDb();

  const sampleUserId = 'test_user_123';
  await upsertChunks([
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
      userId: sampleUserId,
      documentId: 'tech_specs.txt',
      content: 'The server access code for the production cluster is SEC-KEY-9942-X. Do not share this key.',
      chunkIndex: 0,
    },
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      userId: sampleUserId,
      documentId: 'general_info.txt',
      content: 'Our cloud servers are hosted on AWS in the us-east-1 region.',
      chunkIndex: 0,
    },
  ]);

  console.log('\n--- [STEP 2] Querying Exact Key: "SEC-KEY-9942-X" ---');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: sampleUserId,
      message: 'What is the key SEC-KEY-9942-X used for?',
      history: [],
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.replace('data: ', '').trim();
        if (raw === '[DONE]') break;

        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'metadata') {
            console.log('\n🔍 Retrived Chunks (Hybrid Match Types):');
            console.dir(parsed.retrievedChunks, { depth: null });
            console.log('\n🤖 Answer:');
          } else if (parsed.type === 'text') {
            process.stdout.write(parsed.text);
          }
        } catch {}
      }
    }
  }

  console.log('\n\n✅ Hybrid Search Test Complete!');
}

testHybridSearch();