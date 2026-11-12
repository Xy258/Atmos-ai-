import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.ts';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger helper to support req.log in routes
  app.use((req, _res, next) => {
    (req as any).log = {
      info: (...args: any[]) => console.log('[INFO]', ...args),
      warn: (...args: any[]) => console.warn('[WARN]', ...args),
      error: (...args: any[]) => console.error('[ERROR]', ...args),
    };
    next();
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  return app;
}

export default createApp;
