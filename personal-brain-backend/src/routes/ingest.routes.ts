// src/routes/ingest.routes.ts
import { Router, Request, Response } from 'express';
import pdfParse from 'pdf-parse';
import { processAndIngestDocument } from '../services/vector.service.js';

const router = Router();

router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const { userId, documentId, rawText } = req.body;

    let textToProcess = rawText;

    // Handle base64 encoded PDF or raw buffer if passed
    if (documentId.endsWith('.pdf') && rawText.startsWith('data:application/pdf;base64,')) {
      const base64Data = rawText.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Fix for CommonJS pdf-parse typing
      const parseFunc = (pdfParse as any).default || pdfParse;
      const parsedPdf = await parseFunc(buffer);
      textToProcess = parsedPdf.text;
    }

    await processAndIngestDocument({
      userId,
      documentId,
      rawText: textToProcess,
    });

    res.status(200).json({
      success: true,
      message: `Successfully ingested document '${documentId}'.`,
    });
  } catch (error) {
    console.error('Error during document ingestion:', error);
    res.status(500).json({ error: 'Failed to ingest document.' });
  }
});

export default router;