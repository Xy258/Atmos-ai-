import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@tanstack/react-query',
        'framer-motion',
        'recharts',
        'wouter',
      ],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@workspace/api-client-react': path.resolve(__dirname, 'src/api-client/index.ts'),
        '@workspace/api-zod': path.resolve(__dirname, 'server/api-zod/index.ts'),
        '@assets': path.resolve(__dirname, 'attached_assets'),
      },
    },
    optimizeDeps: {
      entries: ['index.html', 'src/main.tsx', 'src/App.tsx'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@tanstack/react-query',
        'framer-motion',
        'recharts',
        'lucide-react',
        'wouter',
        'three',
        'd3',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        '@radix-ui/react-toast',
        '@radix-ui/react-tooltip',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
