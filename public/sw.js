const CACHE_NAME = 'atmos-v4';
const WEATHER_CACHE = 'atmos-weather-cache';
const CONFIG_CACHE = 'atmos-sync-config';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
];

// Helper to construct Open-Meteo URLs for a given coordinate
function buildWeatherUrls(lat, lon) {
  const forecastParams = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=7&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,dew_point_2m,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,apparent_temperature,surface_pressure,dew_point_2m,precipitation_probability,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,uv_index_max`;
  const airParams = `latitude=${lat}&longitude=${lon}&timezone=auto&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,european_aqi&hourly=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,european_aqi`;

  return [
    `https://api.open-meteo.com/v1/forecast?${forecastParams}`,
    `https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`,
  ];
}

// 1. Service Worker Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Service Worker Activation & Cache Cleanup
self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, WEATHER_CACHE, CONFIG_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!allowedCaches.includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Periodic Background Sync Event Handler
self.addEventListener('periodicsync', (event) => {
  if (
    event.tag === 'weather-update' ||
    event.tag === 'weather-periodic-sync' ||
    event.tag === 'get-daily-weather'
  ) {
    event.waitUntil(syncWeatherData('periodicsync'));
  }
});

// 4. One-off Background Sync Event Handler (network reconnection)
self.addEventListener('sync', (event) => {
  if (event.tag === 'weather-sync' || event.tag === 'weather-update') {
    event.waitUntil(syncWeatherData('sync'));
  }
});

// 5. Core Periodic Background Sync Engine
async function syncWeatherData(source = 'periodic') {
  console.log(`[Atmos SW] Initiating background weather sync via ${source}...`);
  let updatedCount = 0;

  try {
    const weatherCache = await caches.open(WEATHER_CACHE);
    const configCache = await caches.open(CONFIG_CACHE);

    // Collect URLs to refresh
    const targetUrls = new Set();

    // A. Read active location config from cache
    try {
      const locResponse = await configCache.match('/api/sync/active-location');
      if (locResponse) {
        const locationData = await locResponse.json();
        if (
          typeof locationData.latitude === 'number' &&
          typeof locationData.longitude === 'number'
        ) {
          const generatedUrls = buildWeatherUrls(
            locationData.latitude,
            locationData.longitude
          );
          generatedUrls.forEach((u) => targetUrls.add(u));
        }
      }
    } catch (e) {
      console.warn('[Atmos SW] Error reading sync location config:', e);
    }

    // B. Re-fetch all open-meteo URLs currently in the weather cache
    try {
      const cachedRequests = await weatherCache.keys();
      for (const req of cachedRequests) {
        const u = new URL(req.url);
        if (u.hostname.includes('open-meteo.com')) {
          targetUrls.add(req.url);
        }
      }
    } catch (e) {
      console.warn('[Atmos SW] Error querying weather cache keys:', e);
    }

    // C. Execute fresh background fetches for all target URLs
    const fetchPromises = Array.from(targetUrls).map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'AtmosPWA/1.0 (PeriodicSync)' },
          cache: 'reload',
        });
        if (response && response.status === 200) {
          await weatherCache.put(url, response.clone());
          updatedCount++;
        }
      } catch (err) {
        // Network might be slow or offline; preserve existing cached data
      }
    });

    await Promise.allSettled(fetchPromises);

    // D. Record sync status metadata
    const syncStatus = {
      timestamp: Date.now(),
      source,
      updatedCount,
      success: true,
    };
    await configCache.put(
      '/api/sync/status',
      new Response(JSON.stringify(syncStatus), {
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // E. Broadcast notification to open tabs
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'WEATHER_SYNC_COMPLETED',
        timestamp: Date.now(),
        source,
        updatedCount,
      });
    }

    console.log(
      `[Atmos SW] Background sync finished (${source}). Updated ${updatedCount} weather caches.`
    );
  } catch (err) {
    console.error('[Atmos SW] Background weather sync error:', err);
  }
}

// 6. Handle Client Messages
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SET_SYNC_LOCATION' && data.location) {
    caches.open(CONFIG_CACHE).then((cache) => {
      cache.put(
        '/api/sync/active-location',
        new Response(JSON.stringify(data.location), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  }

  if (data.type === 'TRIGGER_WEATHER_SYNC') {
    event.waitUntil(
      syncWeatherData('client-request').then(() => {
        if (event.source) {
          event.source.postMessage({
            type: 'WEATHER_SYNC_ACK',
            timestamp: Date.now(),
          });
        }
      })
    );
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper to mark responses served from offline cache so the UI can reflect cached freshness
async function withCacheHitHeader(cachedResponse) {
  if (!cachedResponse) return cachedResponse;
  try {
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Atmos-Cache', 'HIT');
    const body = await cachedResponse.arrayBuffer();
    return new Response(body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  } catch {
    return cachedResponse;
  }
}

// 7. Network Interception & Offline Fallback Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests or non-HTTP(S) schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // NEVER intercept or cache Vite dev server modules, pre-bundled deps (?v=), HMR, or backend API routes.
  // Caching /node_modules/.vite/deps/* across dev restarts causes duplicate React instances ("Invalid hook call").
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/node_modules/') ||
      url.pathname.startsWith('/@vite') ||
      url.pathname.startsWith('/@react-refresh') ||
      url.pathname.startsWith('/@fs/') ||
      url.pathname.startsWith('/@id/') ||
      url.pathname.startsWith('/src/') ||
      url.pathname.startsWith('/api/') ||
      url.searchParams.has('v') ||
      url.searchParams.has('t') ||
      url.searchParams.has('import'))
  ) {
    return;
  }

  // Weather API (Open-Meteo): Fast Network with resilient Cache fallback
  if (url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      caches.open(WEATHER_CACHE).then(async (cache) => {
        // If device is offline, immediately return cached response
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await cache.match(request);
          if (cached) return withCacheHitHeader(cached);
        }

        try {
          // Timeout network fetch after 4 seconds for immediate offline / poor-connection recovery
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const networkResponse = await fetch(request, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Network failed or timed out — return cached copy
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return withCacheHitHeader(cachedResponse);
          }
          throw err;
        }
      })
    );
    return;
  }

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // HTML navigations: Network-First with Cache fallback so updated builds load cleanly
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match('/index.html');
        })
    );
    return;
  }

  // Production static assets (/assets/*, icons, manifest): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
