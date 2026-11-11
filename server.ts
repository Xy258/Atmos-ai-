import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();

  // Parse arguments for port if provided via CLI --port
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const portArg = portIndex !== -1 ? args[portIndex + 1] : undefined;
  const PORT = Number(process.env.PORT || portArg || 3000);

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

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Atmos Server] Running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[Atmos Server] Error listening on port:', err);
    process.exit(1);
  });
}

startServer();
