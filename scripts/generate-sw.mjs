import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const OUT_DIR = path.join(process.cwd(), 'out');
const SW_FILE = path.join(OUT_DIR, 'sw.js');

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

function computeHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha1');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').substring(0, 8);
}

function generateSW() {
  console.log('Generating Service Worker...');

  if (!fs.existsSync(OUT_DIR)) {
    console.error(`Error: build directory "${OUT_DIR}" does not exist. Run "next build" first.`);
    process.exit(1);
  }

  const files = getFilesRecursively(OUT_DIR);
  const precacheEntries = [];
  const timestamp = Date.now();

  files.forEach((file) => {
    const relativePath = path.relative(OUT_DIR, file).replace(/\\/g, '/');

    // Skip service worker itself, source maps, and other metadata
    if (
      relativePath === 'sw.js' ||
      relativePath.endsWith('.map') ||
      relativePath === 'robots.txt' ||
      relativePath.startsWith('server/')
    ) {
      return;
    }

    const hash = computeHash(file);
    // Precache entries should have leading slash
    precacheEntries.push({
      url: `/${relativePath}`,
      revision: hash,
    });
  });

  const swContent = `/**
 * Money Ledger Service Worker
 * Generated automatically at build time.
 */

const CACHE_NAME = 'money-ledger-cache-v${timestamp}';
const PRECACHE_ASSETS = ${JSON.stringify(precacheEntries, null, 2)};

// Install Event: Precache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching all assets...');
      const urlsToCache = PRECACHE_ASSETS.map(entry => entry.url);
      return cache.addAll(urlsToCache);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Handle routing and serving from cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass Firestore calls (let Firestore SDK handle its own offline persistence)
  if (url.hostname === 'firestore.googleapis.com') {
    return;
  }

  // 2. Firebase Auth endpoints — network-first with cache fallback (3s timeout)
  if (url.hostname.endsWith('.googleapis.com') && event.request.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open('firebase-auth');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const networkResponse = await fetch(event.request, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return new Response('Auth offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 3. Non-GET requests to googleapis — let them pass through
  if (url.hostname.endsWith('.googleapis.com')) {
    return;
  }

  // 4. We only handle HTTP/HTTPS GET requests
  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }

  // 4. Navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Clean URLs support: resolve /personal to /personal.html
      let cacheKey = url.pathname;
      if (cacheKey === '/') {
        cacheKey = '/index.html';
      } else if (!cacheKey.endsWith('.html') && !cacheKey.includes('.')) {
        cacheKey = cacheKey + '.html';
      }

      // Check cache first
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, try network, then fallback to offline/index page
      try {
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (error) {
        console.warn('[Service Worker] Navigation failed, serving offline page:', error);
        const offlinePage = await cache.match('/offline.html') || await cache.match('/index.html');
        if (offlinePage) {
          return offlinePage;
        }
        throw error;
      }
    })());
    return;
  }

  // 5. Static Assets (images, fonts, scripts, stylesheets, manifest)
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    
    // Check if it is a match in our precached assets (matches exact path or with query params)
    const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    // Dynamic caching for other GET resources requested on the fly (e.g. CDNs)
    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse && networkResponse.status === 200) {
        // Cache external assets like Google Fonts dynamically
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Return 503 for missing assets offline
      return new Response('Resource offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
`;

  fs.writeFileSync(SW_FILE, swContent);
  console.log(`Service Worker generated successfully at ${SW_FILE}`);
  console.log(`Precached ${precacheEntries.length} assets.`);
}

generateSW();
