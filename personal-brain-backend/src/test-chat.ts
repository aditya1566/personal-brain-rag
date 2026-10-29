// src/test-chat.ts
import dotenv from 'dotenv';
import { initVectorDb, upsertChunks } from './services/vector.service.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api/chat';

async function testMemoryChat() {
  console.log('--- [STEP 1] Initializing Vector DB & Seeding Sample Chunks ---');
  await initVectorDb();

  const sampleUserId = 'test_user_123';
  await upsertChunks([
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      userId: sampleUserId,
      documentId: 'doc_wifi_setup.pdf',
      content: 'The company Wi-Fi network is named "Corp-Secure". The password changes on the 1st of every month and is posted on Slack in #it-announcements.',
      chunkIndex: 0,
    },
  ]);

  // Turn 1: Initial Question
  console.log('\n--- [TURN 1] Sending Initial Question ---');
  const turn1Payload = {
    userId: sampleUserId,
    message: 'What is the company Wi-Fi name?',
    history: [],
  };

  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(turn1Payload),
  });
  const data1 = await res1.json();

  console.log('User:', turn1Payload.message);
  console.log('🤖 Answer:', data1.answer);

  // Turn 2: Follow-up Question relying on memory ("where is the password posted?")
  console.log('\n--- [TURN 2] Sending Follow-Up Question with History ---');
  const history = [
    { role: 'user', content: turn1Payload.message },
    { role: 'model', content: data1.answer },
  ];

  const turn2Payload = {
    userId: sampleUserId,
    message: 'And where can I find its password?', // "its" refers to Wi-Fi from memory!
    history: history,
  };

  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(turn2Payload),
  });
  const data2 = await res2.json();

  console.log('User:', turn2Payload.message);
  console.log('🤖 Answer:', data2.answer);
}

testMemoryChat();