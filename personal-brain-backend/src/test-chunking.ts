import fs from 'fs';
import path from 'path';
import { extractTextFromPDF, generateChunks } from './services/chunking.service.js';

const runPDFTest = async () => {
  try {
    // 1. Resolve the absolute path to your PDF file
    const pdfPath = path.resolve(process.cwd(), 'test-files', 'sample-manual.pdf');
    console.log(`[STEP 1] Looking for PDF at: ${pdfPath}`);

    // Verify the file actually exists before attempting to read it
    if (!fs.existsSync(pdfPath)) {
      console.error(`\n[ERROR] No PDF found at ${pdfPath}`);
      console.error('Please create a "test-files" folder in your root directory and put a "sample-manual.pdf" inside it!');
      return;
    }

    // 2. Read the file into a binary Buffer
    console.log('[STEP 2] Reading file into memory Buffer...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`File read successfully. Buffer size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);

    // 3. Extract and clean the raw text
    console.log('[STEP 3] Extracting text using pdf-parse...');
    const rawText = await extractTextFromPDF(pdfBuffer);
    console.log(`Extracted ${rawText.length} total characters of clean text.\n`);

    // Preview the first 300 characters of the extracted document
    console.log('--- DOCUMENT PREVIEW (First 300 chars) ---');
    console.log(rawText.slice(0, 300) + '...\n');

    // 4. Generate chunks (Using production sizes: 500 characters, 50 character overlap)
    console.log('[STEP 4] Running LangChain RecursiveCharacterTextSplitter...');
    const chunks = await generateChunks(rawText, 500, 50);

    console.log(`\n==================================================`);
    console.log(`SUCCESS: Document split into ${chunks.length} overlapping chunks!`);
    console.log(`==================================================\n`);

    // 5. Display the first 3 chunks to verify boundary overlap in the terminal
    const chunksToDisplay = Math.min(3, chunks.length);
    for (let i = 0; i < chunksToDisplay; i++) {
      const chunk = chunks[i];
      console.log(`[CHUNK #${chunk.metadata.chunkIndex}] -- Length: ${chunk.metadata.characterCount} chars`);
      console.log(`"${chunk.content}"`);
      console.log('--------------------------------------------------\n');
    }

    if (chunks.length > 3) {
      console.log(`... and ${chunks.length - 3} more chunks ready for vector embedding.`);
    }

  } catch (error) {
    console.error('Test script failed:', error);
  }
};

// Execute the test function and print final completion message
runPDFTest()
  .then(() => console.log('\n✅ [TEST COMPLETE] PDF successfully read, extracted, and chunked!'))
  .catch((err) => console.error('\n💥 [TEST FAILED]', err));