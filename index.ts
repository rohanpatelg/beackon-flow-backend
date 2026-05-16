import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import apiRoutes from '@/routes';
import { swaggerDocument, swaggerOptions } from '@/utils/swagger';
import { log, maskKey } from '@/utils/logger';
import { requestLogger } from '@/middlewares/requestLogger';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';

// Load environment variables
dotenv.config();

// Initialize database connection (logs DB status on its own)
import '@/config/database';

const app = express();

// Middleware
app.use(
  cors({
    credentials: true,
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

const PORT = process.env.PORT || 8080;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Beacon Flow API' });
});

// API routes
app.use('/api', apiRoutes);

// 404 + global error handler — must be registered LAST
app.use(notFoundHandler);
app.use(errorHandler);

// Crash-safety: log unhandled rejections / exceptions so we don't die silently
process.on('unhandledRejection', (reason: any) => {
  log.error('Unhandled promise rejection', {
    message: reason?.message ?? String(reason),
    stack: reason?.stack,
  });
});
process.on('uncaughtException', (err: any) => {
  log.error('Uncaught exception', { message: err?.message, stack: err?.stack });
});

app.listen(PORT, () => {
  log.info('───────────────────────────────────────────────');
  log.info('Beacon Flow backend started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    llmProvider: (process.env.LLM_PROVIDER || 'openai').toLowerCase(),
    openaiKey: maskKey(process.env.OPENAI_API_KEY),
    anthropicKey: maskKey(process.env.ANTHROPIC_API_KEY),
    anthropicModel: process.env.ANTHROPIC_MODEL || '(default)',
    frontendOrigin: process.env.FRONTEND_URL || 'http://localhost:3000',
  });
  log.info(`API docs: http://localhost:${PORT}/api-docs`);
  log.info('───────────────────────────────────────────────');
});

export default app;
