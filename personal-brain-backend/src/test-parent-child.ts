// src/test-parent-child.ts
import dotenv from 'dotenv';
import { initVectorDb, processAndIngestDocument } from './services/vector.service.js';

dotenv.config();

const API_URL = 'http://localhost:5000/api/chat';

async function testParentChildRAG() {
  console.log('--- [STEP 1] Initializing Vector DB & Processing Document ---');
  await initVectorDb();

  const sampleUserId = 'test_user_123';
  
  // A long policy document
  const longDocumentText = `
  SECURITY REGULATION SECTION 4.1: Password Policy.
  All corporate credentials must contain at least 16 characters including numbers and symbols.
  Passwords expire every 90 days and must be updated via the employee portal.

  SECURITY REGULATION SECTION 4.2: Equipment Maintenance.
  Laptops must undergo bi-annual hardware audits conducted by IT Operations on the 3rd floor.
  Failure to present laptops for audit results in immediate access restriction.

  SECURITY REGULATION SECTION 4.3: Remote Access & VPN.
  When working remotely, employees must use GlobalProtect VPN with multi-factor authentication enabled.
  Direct connection to internal production databases without VPN is strictly prohibited.
  `;

  await processAndIngestDocument({
    documentId: 'sec_policy_2026.pdf',
    userId: sampleUserId,
    rawText: longDocumentText,
  });

  console.log('\n--- [STEP 2] Asking Specific Question ("How often do passwords expire?") ---');
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: sampleUserId,
      message: 'How often do passwords expire according to the security policy?',
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
            console.log('\n🔍 Retrived Parent Context Chunk Preview:');
            console.dir(parsed.retrievedChunks, { depth: null });
            console.log('\n🤖 Answer:');
          } else if (parsed.type === 'text') {
            process.stdout.write(parsed.text);
          }
        } catch {}
      }
    }
  }

  console.log('\n\n✅ Parent-Child RAG Test Complete!');
}

testParentChildRAG();