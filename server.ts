import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes/index.ts';

import { createApp } from './server/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = createApp();

  // Parse arguments for port if provided via CLI --port
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const portArg = portIndex !== -1 ? args[portIndex + 1] : undefined;
  const PORT = Number(process.env.PORT || portArg || 3000);

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
