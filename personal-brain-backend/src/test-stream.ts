// src/test-stream.ts
import dotenv from 'dotenv';
import { initVectorDb, upsertChunks } from './services/vector.service.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api/chat';

async function testStreamingChat() {
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

  console.log('\n--- [STEP 2] Sending Stream Request ---');
  const testPayload = {
    userId: sampleUserId,
    message: 'How do I connect to the corporate Wi-Fi?',
    history: [],
  };

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  if (!response.body) {
    throw new Error('No response body available for streaming.');
  }

  console.log('\n🤖 Answer (Streaming live):');
  process.stdout.write('👉 ');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || ''; // keep remaining incomplete buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const rawData = line.replace('data: ', '').trim();

        if (rawData === '[DONE]') {
          console.log('\n\n✅ Stream Finished Successfully!');
          return;
        }

        try {
          const parsed = JSON.parse(rawData);
          if (parsed.type === 'metadata') {
            // Un-comment if you want to inspect metadata
            // console.log('\n[Metadata Received]', parsed.retrievedChunks);
          } else if (parsed.type === 'text') {
            // Write incoming words directly to standard output without newlines
            process.stdout.write(parsed.text);
          }
        } catch {
          // Ignore parse errors on raw tokens
        }
      }
    }
  }
}

testStreamingChat();