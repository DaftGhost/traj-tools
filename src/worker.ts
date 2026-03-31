/**
 * Cloudflare Worker for Tianditu proxy + SPA hosting
 */

import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';

// Allowed Tianditu layers
const ALLOWED_LAYERS = ['vec_w', 'cva_w', 'img_w', 'cia_w', 'ter_w', 'cta_w'];

// Tianditu tile server base URLs
const TIANDITU_BASE = 'https://t{s}.tianditu.gov.cn';

// Cache TTLs
const CACHE_MAX_AGE = 2592000; // 30 days
const CACHE_STALE_WHILE_REVALIDATE = 86400; // 1 day
const CACHE_STALE_IF_ERROR = 2592000; // 30 days

interface Env {
  TIANDITU_API_KEY: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Generate a stable cache key for a tile request
 * Returns a fully-qualified URL for Cache API compatibility
 * Avoids cache fragmentation from random subdomain selection
 */
function getCacheKey(layer: string, z: string, y: string, x: string): string {
  // Cache API requires valid URLs - use dummy origin with stable path
  return `https://tianditu-cache.internal/tiles/${layer}/${z}/${y}/${x}`;
}

/**
 * Get cache status header value
 */
type CacheStatus = 'HIT' | 'MISS';

function getCacheHeaders(status: CacheStatus): Record<string, string> {
  return {
    'X-Cache': status,
  };
}

/**
 * Get enhanced Cache-Control headers with SWR and stale-if-error
 */
function getCacheControlHeaders(): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_STALE_WHILE_REVALIDATE}, stale-if-error=${CACHE_STALE_IF_ERROR}`,
  };
}

/**
 * Health check endpoint - returns 200 if Tianditu API key is configured
 */
async function handleHealthCheck(env: Env): Promise<Response> {
  const key = env.TIANDITU_API_KEY;
  if (key && key.trim().length > 0) {
    return new Response(JSON.stringify({ available: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ available: false, reason: 'TIANDITU_API_KEY not configured' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Proxy tile request to Tianditu with cache-first + stale-on-error strategy
 */
async function handleTileProxy(env: Env, layer: string, z: string, y: string, x: string, ctx: WorkerContext): Promise<Response> {
  const key = env.TIANDITU_API_KEY;
  const cacheKey = getCacheKey(layer, z, y, x);
  const cache = caches as unknown as { default: Cache };

  // Check if key is configured
  if (!key || key.trim().length === 0) {
    return new Response('TIANDITU_API_KEY not configured', { status: 503 });
  }

  // Validate layer
  if (!ALLOWED_LAYERS.includes(layer)) {
    return new Response(`Invalid layer: ${layer}`, { status: 400 });
  }

  // Validate coordinates
  const zoom = parseInt(z, 10);
  const tileX = parseInt(x, 10);
  const tileY = parseInt(y, 10);

  if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
    return new Response('Invalid tile coordinates', { status: 400 });
  }

  // Try cache first
  const cachedResponse = await cache.default.match(cacheKey);
  if (cachedResponse) {
    // Return cached response immediately to avoid extra upstream requests.
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  // Cache miss - fetch from upstream
  return fetchAndCacheTile(cacheKey, layer, z, y, x, key, ctx);
}

/**
 * Fetch tile from Tianditu and cache successful responses
 */
async function fetchAndCacheTile(
  cacheKey: string,
  layer: string,
  z: string,
  y: string,
  x: string,
  apiKey: string,
  ctx: WorkerContext
): Promise<Response> {
  // Build Tianditu WMTS URL
  // Format: https://t{0-7}.tianditu.gov.cn/{layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&...
  const subdomain = Math.floor(Math.random() * 8).toString();
  const baseUrl = TIANDITU_BASE.replace('{s}', subdomain);

  // Extract base layer name (e.g., 'vec' from 'vec_w')
  const baseLayer = layer.replace('_w', '');

  const url = `${baseUrl}/${layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${baseLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${apiKey}`
    .replace('{z}', z)
    .replace('{y}', y)
    .replace('{x}', x);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/png,image/jpeg,image/*',
        'User-Agent': 'traj-tools/2.0',
      },
    });

    if (!response.ok) {
      return new Response(`Tianditu error: ${response.status}`, { status: response.status });
    }

    // Only cache successful responses (200-299)
    if (response.status >= 200 && response.status < 300) {
      const headers = new Headers(response.headers);

      // Set enhanced caching headers
      for (const [name, value] of Object.entries(getCacheControlHeaders())) {
        headers.set(name, value);
      }
      headers.set('X-Cache', 'MISS');

      const cacheResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      // Store in cache (don't await - fire and forget)
      const cache = caches as unknown as { default: Cache };
      ctx.waitUntil(cache.default.put(cacheKey, cacheResponse.clone()));

      return cacheResponse;
    }

    // Non-2xx responses - don't cache
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        ...getCacheHeaders('MISS'),
      },
    });
  } catch (error) {
    console.error('Tianditu proxy error:', error);

    // Try to return stale cached response on error
    const cache = caches as unknown as { default: Cache };
    const staleResponse = await cache.default.match(cacheKey);
    if (staleResponse) {
      const headers = new Headers(staleResponse.headers);
      headers.set('X-Cache', 'STALE');
      headers.set('Warning', '110 - Response is stale');
      return new Response(staleResponse.body, {
        status: staleResponse.status,
        statusText: 'Stale (upstream error)',
        headers,
      });
    }

    return new Response('Proxy error', { status: 502 });
  }
}

/**
 * Serve SPA for all non-API requests
 */
async function serveSPA(request: Request): Promise<Response> {
  try {
    const response = await getAssetFromKV(
      { request } as unknown as FetchEvent,
      {
        mapRequestToAsset: (req: Request) => {
          const url = new URL(req.url);
          // For SPA, serve index.html for all non-file requests
          if (!url.pathname.includes('.')) {
            return new Request(new URL('/index.html', req.url), req);
          }
          return req;
        },
      }
    );
    return response;
  } catch (error) {
    if (error instanceof NotFoundError) {
      // For SPA routing, serve index.html for 404s
      try {
        return await getAssetFromKV(
          { request } as unknown as FetchEvent,
          {
            mapRequestToAsset: () => new Request(new URL('/index.html', request.url), request),
          }
        );
      } catch {
        return new Response('Not Found', { status: 404 });
      }
    }
    return new Response('Internal Error', { status: 500 });
  }
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/api/tianditu/health') {
      return handleHealthCheck(env);
    }

    // Tianditu tile proxy: /api/tianditu/{layer}/{z}/{y}/{x}
    const tileMatch = url.pathname.match(/^\/api\/tianditu\/([a-z_]+)\/(\d+)\/(\d+)\/(\d+)$/);
    if (tileMatch) {
      const [, layer, z, y, x] = tileMatch;
      return handleTileProxy(env, layer, z, y, x, ctx);
    }

    // Serve SPA for all other requests
    return serveSPA(request);
  },
};
