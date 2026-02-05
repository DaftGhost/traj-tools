/**
 * Cloudflare Worker for Tianditu proxy + SPA hosting
 */

import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';

// Allowed Tianditu layers
const ALLOWED_LAYERS = ['vec_w', 'cva_w', 'img_w', 'cia_w', 'ter_w', 'cta_w'];

// Tianditu tile server base URLs
const TIANDITU_BASE = 'https://t{s}.tianditu.gov.cn';

interface Env {
  TIANDITU_API_KEY: string;
}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
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
 * Proxy tile request to Tianditu
 */
async function handleTileProxy(env: Env, layer: string, z: string, y: string, x: string): Promise<Response> {
  const key = env.TIANDITU_API_KEY;

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

  // Build Tianditu WMTS URL
  // Format: https://t{0-7}.tianditu.gov.cn/{layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&...
  const subdomain = Math.floor(Math.random() * 8).toString();
  const baseUrl = TIANDITU_BASE.replace('{s}', subdomain);

  // Extract base layer name (e.g., 'vec' from 'vec_w')
  const baseLayer = layer.replace('_w', '');

  const url = `${baseUrl}/${layer}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${baseLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`
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

    // Pass through caching headers but limit max-age
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=86400'); // 1 day cache

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('Tianditu proxy error:', error);
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
      return handleTileProxy(env, layer, z, y, x);
    }

    // Serve SPA for all other requests
    return serveSPA(request);
  },
};
