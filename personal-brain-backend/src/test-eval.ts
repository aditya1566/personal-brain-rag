// src/test-eval.ts
import { evaluateFaithfulness } from './services/eval.service.js';

async function runEvaluationTests() {
  console.log('===================================================');
  console.log('🧪 RAG FAITHFULNESS EVALUATION BENCHMARK');
  console.log('===================================================\n');

  const sampleContext = `
  The server access code for the production cluster is SEC-KEY-9942-X.
  All maintenance must be scheduled on Sunday between 2:00 AM and 4:00 AM EST.
  `;

  const question = 'What is the server access key and when is maintenance scheduled?';

  // SCENARIO 1: Faithful Answer (100% grounded in context)
  console.log('--- 🟢 TEST 1: Evaluating Faithful Answer ---');
  const faithfulAnswer =
    'The server access key is SEC-KEY-9942-X, and maintenance is scheduled on Sunday between 2:00 AM and 4:00 AM EST.';

  console.log(`Answer: "${faithfulAnswer}"\n`);
  const eval1 = await evaluateFaithfulness(sampleContext, question, faithfulAnswer);
  
  console.log('📊 Evaluation Results:');
  console.log(`- Faithfulness Score: ${(eval1.faithfulnessScore * 100).toFixed(0)}%`);
  console.log(`- Is Faithful: ${eval1.isFaithful ? '✅ YES' : '❌ NO'}`);
  console.log(`- Supported Claims: ${eval1.supportedClaims} / ${eval1.totalClaims}`);
  console.log(`- Reasoning: ${eval1.reasoning}\n`);

  // SCENARIO 2: Hallucinated Answer (Contains ungrounded/outside claims)
  console.log('--- 🔴 TEST 2: Evaluating Hallucinated Answer ---');
  const hallucinatedAnswer =
    'The server access key is SEC-KEY-9942-X. Maintenance is scheduled on Sunday between 2:00 AM and 4:00 AM EST, and the backup administrator is John Doe on port 8080.';

  console.log(`Answer: "${hallucinatedAnswer}"\n`);
  const eval2 = await evaluateFaithfulness(sampleContext, question, hallucinatedAnswer);

  console.log('📊 Evaluation Results:');
  console.log(`- Faithfulness Score: ${(eval2.faithfulnessScore * 100).toFixed(0)}%`);
  console.log(`- Is Faithful: ${eval2.isFaithful ? '✅ YES' : '❌ NO'}`);
  console.log(`- Supported Claims: ${eval2.supportedClaims} / ${eval2.totalClaims}`);
  console.log(`- Reasoning: ${eval2.reasoning}`);
  if (eval2.unsupportedClaims.length > 0) {
    console.log(`- Unsupported Claims Detected:`);
    eval2.unsupportedClaims.forEach((claim) => console.log(`   ⚠️  "${claim}"`));
  }

  console.log('\n===================================================');
  console.log('✅ Faithfulness Benchmark Test Complete');
  console.log('===================================================');
}

runEvaluationTests();