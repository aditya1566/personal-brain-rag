// src/services/eval.service.ts
import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configured as a strict evaluator
const evalModel = genAI.getGenerativeModel({
  model: 'gemini-flash-latest',
  generationConfig: {
    temperature: 0.0, // Zero temperature for deterministic evaluation
    responseMimeType: 'application/json',
  },
});

export interface EvalResult {
  faithfulnessScore: number; // 0.0 to 1.0
  isFaithful: boolean;
  totalClaims: number;
  supportedClaims: number;
  reasoning: string;
  unsupportedClaims: string[];
}

export async function evaluateFaithfulness(
  context: string,
  userQuestion: string,
  generatedAnswer: string
): Promise<EvalResult> {
  const prompt = `
You are an expert AI Evaluator specializing in hallucination detection for Retrieval-Augmented Generation (RAG) systems.

### TASK:
Evaluate whether the GENERATED ANSWER is FAITHFUL to the provided CONTEXT. 

### DEFINITION OF FAITHFULNESS:
An answer is faithful if EVERY factual claim in the generated answer is directly supported by the context.
If the generated answer includes outside knowledge, unverified assumptions, or facts NOT in the context, those claims are UNSUPPORTED.

### INPUT DATA:
<context>
${context}
</context>

<user_question>
${userQuestion}
</user_question>

<generated_answer>
${generatedAnswer}
</generated_answer>

### INSTRUCTIONS:
1. Break down the GENERATED ANSWER into atomic factual statements/claims.
2. For each claim, check if it is directly supported by the text in <context>.
3. Calculate faithfulnessScore = (Number of Supported Claims) / (Total Number of Claims).
4. If Total Number of Claims is 0 (e.g. "I don't know"), faithfulnessScore is 1.0.

Return JSON in this EXACT schema:
{
  "faithfulnessScore": number,
  "isFaithful": boolean,
  "totalClaims": number,
  "supportedClaims": number,
  "reasoning": "Brief explanation of the evaluation",
  "unsupportedClaims": ["List of claims not found in context"]
}
`;

  try {
    const result = await evalModel.generateContent(prompt);
    const textResponse = result.response.text();
    const parsedEval: EvalResult = JSON.parse(textResponse);
    return parsedEval;
  } catch (error) {
    console.error('Error during faithfulness evaluation:', error);
    return {
      faithfulnessScore: 0,
      isFaithful: false,
      totalClaims: 0,
      supportedClaims: 0,
      reasoning: 'Evaluation failed due to parsing or network error.',
      unsupportedClaims: [],
    };
  }
}