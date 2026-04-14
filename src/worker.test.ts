import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './worker';

const ctx = {
  waitUntil: vi.fn(),
};

describe('worker MBTiles proxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ctx.waitUntil.mockReset();
  });

  it('returns an empty catalog when no MBTiles proxy is configured', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/mbtiles/catalog'),
      {
        TIANDITU_API_KEY: '',
      },
      ctx
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sources: [] });
  });

  it('proxies MBTiles requests when MBTILES_PROXY_URL is configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe('http://127.0.0.1:3001/api/mbtiles/catalog');
      return new Response(JSON.stringify({ sources: [{ id: 'demo' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/mbtiles/catalog'),
      {
        TIANDITU_API_KEY: '',
        MBTILES_PROXY_URL: 'http://127.0.0.1:3001',
      },
      ctx
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sources: [{ id: 'demo' }],
    });
  });

  it('passes mixed raster and vector catalog payloads through unchanged', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe('http://127.0.0.1:3001/api/mbtiles/catalog');

      return new Response(
        JSON.stringify({
          sources: [
            {
              id: 'raster-source',
              label: 'Raster Source',
              format: 'png',
              minZoom: 0,
              maxZoom: 14,
              bounds: [73, 18, 135, 54],
              attribution: 'Local Raster',
              sourceType: 'raster',
            },
            {
              id: 'vector-source',
              label: 'Vector Source',
              format: 'pbf',
              minZoom: 0,
              maxZoom: 14,
              bounds: [73, 18, 135, 54],
              attribution: 'Local Vector',
              sourceType: 'vector',
              vectorLayers: [
                {
                  id: 'roads',
                  description: 'Road network',
                  minZoom: 0,
                  maxZoom: 14,
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request('https://example.com/api/mbtiles/catalog'),
      {
        TIANDITU_API_KEY: '',
        MBTILES_PROXY_URL: 'http://127.0.0.1:3001',
      },
      ctx
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sources: [
        {
          id: 'raster-source',
          label: 'Raster Source',
          format: 'png',
          minZoom: 0,
          maxZoom: 14,
          bounds: [73, 18, 135, 54],
          attribution: 'Local Raster',
          sourceType: 'raster',
        },
        {
          id: 'vector-source',
          label: 'Vector Source',
          format: 'pbf',
          minZoom: 0,
          maxZoom: 14,
          bounds: [73, 18, 135, 54],
          attribution: 'Local Vector',
          sourceType: 'vector',
          vectorLayers: [
            {
              id: 'roads',
              description: 'Road network',
              minZoom: 0,
              maxZoom: 14,
            },
          ],
        },
      ],
    });
  });

  it('passes vector tile requests through the generic MBTiles proxy path', async () => {
    const tileBytes = new Uint8Array([31, 139, 8, 0]);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'http://127.0.0.1:3001/api/mbtiles/vector-source/3/4/5?format=pbf'
      );

      return new Response(tileBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.mapbox-vector-tile',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      new Request(
        'https://example.com/api/mbtiles/vector-source/3/4/5?format=pbf'
      ),
      {
        TIANDITU_API_KEY: '',
        MBTILES_PROXY_URL: 'http://127.0.0.1:3001',
      },
      ctx
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.mapbox-vector-tile'
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(tileBytes);
  });
});
