// src/controllers/chat.controller.ts
import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { generateEmbedding, COLLECTION_NAME } from '../services/vector.service.js';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const chatModel = genAI.getGenerativeModel({ 
  model: 'gemini-flash-latest', 
  systemInstruction: `You are a helpful and precise knowledge assistant. 
Your task is to answer the user's question using ONLY the facts provided within the <context> tags below.
If the <context> tags do not contain sufficient information to fully answer the question, explicitly state: "I don't have enough information in my knowledge base to answer that." 
Do NOT rely on outside knowledge or assumptions. Always cite the Source when sharing specific facts.`
});

const TOP_K = 3;

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, userId, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'A valid message string is required.' });
      return;
    }

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'A valid userId is required for RBAC filtering.' });
      return;
    }

    // 1. Vector Search on Child Chunks
    const queryVector = await generateEmbedding(message);

    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 5,
      filter: {
        must: [{ key: 'userId', match: { value: userId } }],
      },
    });

    const contextText = searchResults
    .map((res) => res.payload?.parentContent || res.payload?.childContent)
    .join('\n---\n');


    // 2. Parent Deduplication: Map child search hits to their Parent context
    const parentMap = new Map<string, { parentContent: string; documentId: string; score: number }>();

    searchResults.forEach((hit) => {
      const parentId = hit.payload?.parentId as string;
      const parentContent = hit.payload?.parentContent as string;
      const documentId = hit.payload?.documentId as string;

      if (parentId && parentContent && !parentMap.has(parentId)) {
        parentMap.set(parentId, {
          parentContent,
          documentId,
          score: hit.score,
        });
      }
    });

    // When formatting retrieved Qdrant search results into prompt context:
  
    // 3. Format Parent Context for Prompt Injection
    const parentContexts = Array.from(parentMap.values());
    const contextChunks = parentContexts.map((item, index) => {
      return `[Source Document ID: ${item.documentId} | Score: ${item.score.toFixed(2)}]\n${item.parentContent}`;
    });

    const formattedContext = contextChunks.length > 0
      ? `<context>\n${contextChunks.join('\n\n---\n\n')}\n</context>`
      : '<context>\nNo relevant documents found in the knowledge base for this user.\n</context>';

    // 4. Format History & Current Turn
    const formattedHistory = (history as ChatMessage[]).map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const currentTurn = {
      role: 'user',
      parts: [{ text: `${formattedContext}\n\nUser Question: ${message}` }],
    };

    const fullContents = [...formattedHistory, currentTurn];

    // 5. Setup SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      retrievedChunks: parentContexts.map((p) => ({
        documentId: p.documentId,
        score: p.score,
        preview: p.parentContent.substring(0, 100) + '...',
      })),
    })}\n\n`);

    // 6. Stream LLM Answer
    const streamResult = await chatModel.generateContentStream({
      contents: fullContents,
      generationConfig: { temperature: 0.2 },
    });

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: chunkText })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Error in Parent-Child chat controller:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error during chat streaming.' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream error occurred.' })}\n\n`);
      res.end();
    }
  }
};