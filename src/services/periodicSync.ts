/**
 * Periodic Background Sync & PWA Offline Sync Manager
 * Keeps cached weather data fresh in the background so offline usage has the latest conditions.
 */

export interface SyncStatus {
  timestamp: number;
  source: string;
  updatedCount: number;
  success: boolean;
}

export interface SyncLocationPayload {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

/**
 * Registers Periodic Background Sync with the browser's ServiceWorkerRegistration
 * Supported natively in Chromium-based browsers (Chrome, Edge, Samsung Internet)
 */
export async function registerPeriodicWeatherSync(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // 1. Periodic Background Sync (PeriodicSyncManager)
    if ('periodicSync' in registration) {
      try {
        const periodicSync = (registration as unknown as {
          periodicSync: {
            register: (tag: string, options: { minInterval: number }) => Promise<void>;
            getTags: () => Promise<string[]>;
          };
        }).periodicSync;

        // Query permission if available
        let canRegister = true;
        if ('permissions' in navigator) {
          try {
            const status = await navigator.permissions.query({
              name: 'periodic-background-sync' as PermissionName,
            });
            if (status.state === 'denied') {
              canRegister = false;
            }
          } catch {
            // Permission query not supported on this platform, attempt registration directly
          }
        }

        if (canRegister) {
          // Request periodic update every 3 hours (browser determines actual cadence based on usage)
          await periodicSync.register('weather-update', {
            minInterval: 3 * 60 * 60 * 1000,
          });
          console.log('[Atmos PWA] Periodic background sync registered successfully');
        }
      } catch (err) {
        console.warn('[Atmos PWA] Periodic sync registration deferred:', err);
      }
    }

    // 2. Standard Background Sync (SyncManager)
    if ('sync' in registration) {
      try {
        const syncManager = (registration as unknown as {
          sync: { register: (tag: string) => Promise<void> };
        }).sync;
        await syncManager.register('weather-sync');
      } catch {
        // Not critical if deferred
      }
    }

    return true;
  } catch (err) {
    console.warn('[Atmos PWA] Error registering background sync:', err);
    return false;
  }
}

/**
 * Informs the Service Worker of the currently active location
 * so background sync knows which coordinates to refresh when the app is closed.
 */
export function updateServiceWorkerSyncLocation(location: SyncLocationPayload): void {
  if (typeof window === 'undefined') return;

  // Send message to active Service Worker controller
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_SYNC_LOCATION',
      location: {
        id: location.id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        admin1: location.admin1,
      },
    });
  }

  // Also store directly in CacheStorage for immediate access by the Service Worker
  if (typeof caches !== 'undefined') {
    caches.open('atmos-sync-config').then((cache) => {
      cache.put(
        '/api/sync/active-location',
        new Response(JSON.stringify(location), {
          headers: { 'Content-Type': 'application/json' },
        })
      ).catch(() => {});
    }).catch(() => {});
  }
}

/**
 * Triggers an immediate background sync via the Service Worker
 */
export async function triggerManualWeatherSync(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'TRIGGER_WEATHER_SYNC' });
      return true;
    }
  } catch (err) {
    console.warn('[Atmos PWA] Manual sync trigger failed:', err);
  }
  return false;
}

/**
 * Fetches the last sync status from CacheStorage
 */
export async function getLastSyncStatus(): Promise<SyncStatus | null> {
  if (typeof window === 'undefined' || typeof caches === 'undefined') {
    return null;
  }

  try {
    const cache = await caches.open('atmos-sync-config');
    const res = await cache.match('/api/sync/status');
    if (res) {
      return (await res.json()) as SyncStatus;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Subscribes to weather sync completion messages from the Service Worker
 */
export function onWeatherSyncCompleted(
  callback: (data: { timestamp: number; source: string; updatedCount: number }) => void
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type === 'WEATHER_SYNC_COMPLETED') {
      callback({
        timestamp: event.data.timestamp || Date.now(),
        source: event.data.source || 'periodic',
        updatedCount: event.data.updatedCount || 0,
      });
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}
