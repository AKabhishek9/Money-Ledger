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
    console.error('Error: build directory does not exist. Run next build first.');
    process.exit(1);
  }

  const files = getFilesRecursively(OUT_DIR);
  const precacheEntries = [];
  const timestamp = Date.now();

  files.forEach((file) => {
    const relativePath = path.relative(OUT_DIR, file).replace(/\\/g, '/');

    if (
      relativePath === 'sw.js' ||
      relativePath.endsWith('.map') ||
      relativePath === 'robots.txt' ||
      relativePath.startsWith('server/')
    ) {
      return;
    }

    const hash = computeHash(file);
    precacheEntries.push({
      url: '/' + relativePath,
      revision: hash,
    });
  });

  const swContent = `/**
 * Money Ledger Service Worker
 */

const CACHE_NAME = 'money-ledger-cache-v${timestamp}';
const PRECACHE_ASSETS = ${JSON.stringify(precacheEntries, null, 2)};


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urlsToCache = PRECACHE_ASSETS.map(entry => entry.url);
      const cachePromises = urlsToCache.map(url => {
        return cache.add(url).catch(err => {
          console.warn('Skipping precache asset:', url, err);
        });
      });
      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  if (url.hostname === 'firestore.googleapis.com') {
    return;
  }

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

  if (url.hostname.endsWith('.googleapis.com')) {
    return;
  }

  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      
      let cacheKey = url.pathname;
      if (cacheKey === '/') {
        cacheKey = '/index.html';
      } else if (!cacheKey.endsWith('.html') && !cacheKey.includes('.')) {
        cacheKey = cacheKey + '.html';
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(cacheKey, networkResponse.clone()).catch(err => {
            console.warn('Failed to cache navigation route:', err);
          });
        }
        return networkResponse;
      } catch (error) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }

        const offlinePage = await cache.match('/offline.html') || await cache.match('/index.html');
        if (offlinePage) {
          return offlinePage;
        }
        
        return new Response('Internet connection is offline and this page is not cached.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      }
    })().catch(async () => {
      try {
        return await fetch(event.request);
      } catch (e) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    }));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    
    const cachedResponse = await cache.match(event.request, { ignoreSearch: true });
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse && networkResponse.status === 200) {
        cache.put(event.request, networkResponse.clone()).catch(err => {
          console.warn('Failed to dynamically cache asset:', err);
        });
      }
      return networkResponse;
    } catch (error) {
      return new Response('Resource offline', { status: 503, statusText: 'Offline' });
    }
  })().catch(() => new Response('Offline', { status: 503 })));
});
`;

  fs.writeFileSync(SW_FILE, swContent);
  console.log('Service Worker generated successfully at ' + SW_FILE);
  console.log('Precached ' + precacheEntries.length + ' assets.');
}

generateSW();
