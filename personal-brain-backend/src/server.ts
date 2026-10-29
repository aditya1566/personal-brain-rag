import express, { Request, Response } from 'express';
import chatRoutes from './routes/chat.routes.js';
import ingestRoutes from './routes/ingest.routes.js';
import cors from 'cors';
import dotenv from 'dotenv';
import { register, login } from './controllers/auth.controller.js';
import { authenticateToken } from './middlewares/auth.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Mount the chat API routes
app.use('/api', chatRoutes);
app.use('/api', ingestRoutes);

// Public Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// Protected Endpoint
// (Using standard Express Request because req.user is globally extended)
app.get('/api/protected/me', authenticateToken, (req: Request, res: Response) => {
  res.status(200).json({
    message: 'You have successfully accessed a protected endpoint!',
    user: req.user,
  });
});

app.listen(PORT, () => {
  console.log(`[SERVER] System running securely on http://localhost:${PORT}`);
});

// Root Health Check Endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    message: 'Personal Brain RAG API is up and running!',
  });
});

// Root Health Check Endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    message: 'Personal Brain RAG API is up and running!',
  });
});