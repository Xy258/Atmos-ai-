import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import { registerPeriodicWeatherSync } from '@/services/periodicSync';
import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Register Service Worker with Periodic Background Sync for PWA & offline freshness
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[Atmos] ServiceWorker registered with scope:', reg.scope);
        // Register periodic background sync for automatic weather freshness
        void registerPeriodicWeatherSync();
      })
      .catch((err) => {
        console.warn('[Atmos] ServiceWorker registration failed:', err);
      });
  });
}

