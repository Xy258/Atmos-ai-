import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server/app.ts';

const app = createApp();

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  if (req.url && req.url.includes('__route=')) {
    const parsed = new URL(req.url, 'http://localhost');
    const route = parsed.searchParams.get('__route');
    parsed.searchParams.delete('__route');
    const qs = parsed.searchParams.toString();
    if (route !== null) {
      req.url = `/api/${route.replace(/^\/+/, '')}${qs ? `?${qs}` : ''}`;
    }
  }
  return app(req as any, res as any);
}
