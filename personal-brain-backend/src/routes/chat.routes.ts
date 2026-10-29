// src/routes/chat.routes.ts
import { Router } from 'express';
import { handleChat } from '../controllers/chat.controller.js';

const router = Router();

// POST /api/chat
router.post('/chat', handleChat);

export default router;