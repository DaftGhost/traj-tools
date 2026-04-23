/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { VectorGridProtobuf } from 'leaflet.vectorgrid';
import { resetViewBridgeStateForTests } from '../ui/viewBridge';
import {
  baseLayers,
  getBaseLayerOptions,
  getLastSelectedBaseLayer,
  initializeBaseLayers,
  resetBaseLayerStateForTests,
} from './layers';
import { store } from '../state/store';

vi.mock('leaflet.vectorgrid', () => ({
  VectorGridProtobuf: vi.fn(
    (url: string, options?: Record<string, unknown>) => {
      return L.tileLayer(url, options as L.TileLayerOptions);
    }
  ),
}));

describe('map/layers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetBaseLayerStateForTests();
    resetViewBridgeStateForTests();
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    store.map = L.map(container).setView([30, 110], 12);
  });

  afterEach(() => {
    store.map?.remove();
    store.map = null;
    document.body.innerHTML = '';
  });

  it('registers discovered MBTiles layers and refreshes the selector view', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
          return new Response(
            JSON.stringify({
              sources: [
                {
                  id: 'china-topo',
                  label: 'China Topo',
                  format: 'png',
                  minZoom: 0,
                  maxZoom: 14,
                  bounds: [73, 18, 135, 54],
                  attribution: 'Local MBTiles',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw new Error('Unexpected request: ' + url);
      })
    );

    await initializeBaseLayers();

    expect(baseLayers['mbtiles:china-topo']).toBeDefined();
    expect(
      getBaseLayerOptions().some(
        (option) => option.value === 'mbtiles:china-topo'
      )
    ).toBe(true);
  });

  it('falls back to osm when a saved MBTiles layer is unavailable', async () => {
    localStorage.setItem('selectedBaseLayer', 'mbtiles:missing');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );

    await initializeBaseLayers();

    expect(getLastSelectedBaseLayer()).toBe('osm');
  });

  it('keeps built-in layers available when MBTiles catalog loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
          throw new Error('catalog unavailable');
        }

        throw new Error('Unexpected request: ' + url);
      })
    );

    await initializeBaseLayers();

    expect(baseLayers.osm).toBeDefined();
    expect(baseLayers.satellite).toBeDefined();
    expect(getBaseLayerOptions().some((option) => option.value === 'osm')).toBe(
      true
    );
    expect(
      getBaseLayerOptions().some((option) =>
        option.value.startsWith('mbtiles:')
      )
    ).toBe(false);
  });

  it('registers vector MBTiles sources as VectorGrid entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
          return new Response(
            JSON.stringify({
              sources: [
                {
                  id: 'china-vector',
                  label: 'China Vector',
                  format: 'pbf',
                  minZoom: 0,
                  maxZoom: 14,
                  bounds: [73, 18, 135, 54],
                  attribution: 'Local Vector',
                  sourceType: 'vector',
                  vectorLayers: [
                    {
                      id: 'water',
                      description: 'Water',
                      minZoom: 0,
                      maxZoom: 14,
                    },
                    {
                      id: 'land',
                      description: 'Land',
                      minZoom: 0,
                      maxZoom: 14,
                    },
                    {
                      id: 'roads',
                      description: 'Roads',
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
        }

        throw new Error('Unexpected request: ' + url);
      })
    );

    await initializeBaseLayers();

    expect(baseLayers['mbtiles:china-vector']).toBeDefined();
    expect(
      getBaseLayerOptions().some(
        (option) => option.value === 'mbtiles:china-vector'
      )
    ).toBe(true);
  });

  it('falls back to osm when saved vector MBTiles source disappears', async () => {
    localStorage.setItem('selectedBaseLayer', 'mbtiles:china-vector');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
          return new Response(
            JSON.stringify({
              sources: [
                {
                  id: 'other-raster',
                  label: 'Other Raster',
                  format: 'png',
                  minZoom: 0,
                  maxZoom: 14,
                  bounds: [73, 18, 135, 54],
                  attribution: 'Local',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw new Error('Unexpected request: ' + url);
      })
    );

    await initializeBaseLayers();

    expect(getLastSelectedBaseLayer()).toBe('osm');
    expect(baseLayers['mbtiles:china-vector']).toBeUndefined();
  });

  it('registers both raster and vector MBTiles sources from same catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
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
                  attribution: 'Local',
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
                      id: 'water',
                      description: 'Water',
                      minZoom: 0,
                      maxZoom: 14,
                    },
                    {
                      id: 'roads_labels',
                      description: 'Road Labels',
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
        }

        throw new Error('Unexpected request: ' + url);
      })
    );

    await initializeBaseLayers();

    expect(baseLayers['mbtiles:raster-source']).toBeDefined();
    expect(baseLayers['mbtiles:vector-source']).toBeDefined();
    const options = getBaseLayerOptions();
    expect(options.some((o) => o.value === 'mbtiles:raster-source')).toBe(true);
    expect(options.some((o) => o.value === 'mbtiles:vector-source')).toBe(true);
    expect(
      options.find((o) => o.value === 'mbtiles:raster-source')?.sourceType
    ).toBe('raster');
    expect(
      options.find((o) => o.value === 'mbtiles:vector-source')?.sourceType
    ).toBe('vector');
    const vectorGridMock = VectorGridProtobuf as unknown as {
      mock: {
        calls: Array<
          [
            string,
            | { styles?: Record<string, unknown>; vectorTileLayerStyles?: Record<string, unknown> }
            | undefined,
          ]
        >;
      };
    };
    expect(vectorGridMock).toHaveBeenCalledWith(
      '/api/mbtiles/vector-source/{z}/{x}/{y}',
      expect.objectContaining({
        minZoom: 0,
        maxNativeZoom: 14,
        maxZoom: 18,
        attribution: 'Local Vector',
        interactive: false,
        vectorTileLayerStyles: expect.objectContaining({
          water: expect.any(Object),
        }),
      })
    );
    const vectorOptions = vectorGridMock.mock.calls[0]?.[1];
    expect(vectorOptions?.vectorTileLayerStyles?.roads_labels).toEqual([]);
  });
});
