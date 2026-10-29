// src/services/chunking.service.ts
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFParse } from 'pdf-parse';

export interface ChunkedDocument {
  content: string;
  metadata: {
    chunkIndex: number;
    characterCount: number;
  };
}

/**
 * Strips out excessive whitespace, null bytes, and formatting artifacts
 * often found in raw PDF OCR extracts.
 */
export const cleanRawText = (text: string): string => {
  return text
    .replace(/\x00/g, '') // Remove null bytes that crash PostgreSQL
    .replace(/\r\n/g, '\n') // Standardize line endings
    .replace(/\n{3,}/g, '\n\n') // Collapse excessive line breaks
    .trim();
};

/**
 * Extracts raw text string from a PDF Buffer using pdf-parse v2 class API.
 */
export const extractTextFromPDF = async (pdfBuffer: Buffer): Promise<string> => {
  let parser: any = null;
  try {
    // Pass the buffer via the data configuration object expected by v2
    parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    
    const rawTextString = typeof result === 'string' ? result : result?.text || '';
    const cleanedText = cleanRawText(rawTextString);

    if (!cleanedText || cleanedText.length === 0) {
      throw new Error('PDF contains no extractable text. It may be a scanned image.');
    }

    return cleanedText;
  } catch (error) {
    console.error('[CHUNKING SERVICE] PDF Extraction Error:', error);
    if (error instanceof Error && error.message.includes('scanned image')) {
      throw error;
    }
    throw new Error('Failed to extract text from PDF document');
  } finally {
    // Crucial: Always destroy the parser instance to free worker resources and prevent hanging
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
};

/**
 * Splits clean text into overlapping chunks using LangChain's recursive algorithm.
 */
export const generateChunks = async (
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50
): Promise<ChunkedDocument[]> => {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '\n', ' ', ''],
  });

  const rawChunks = await splitter.splitText(text);

  return rawChunks.map((chunkText, index) => ({
    content: chunkText,
    metadata: {
      chunkIndex: index,
      characterCount: chunkText.length,
    },
  }));
};