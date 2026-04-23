import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
  MbtilesCatalogSource,
  MbtilesVectorLayer,
} from '../src/mbtiles/shared';
import {
  getMbtilesContentType,
  getMbtilesSourceType,
  isGzipCompressed,
} from '../src/mbtiles/shared';
import { maybeDecompress } from './mbtiles-decompress';
import {
  buildCatalogResponse,
  createMbtilesServer,
  createSourceLabel,
  parseTilePath,
  toByteArray,
} from './requestHandlers';

const nullDbInstance = {
  query: () => ({ get: () => null }),
  close: () => {},
};
const throwingDbInstance = {
  query: () => {
    throw new Error('simulated db error');
  },
  close: () => {},
};

const dbBehavior = {
  tileQueryResult: null as unknown,
};

const metadataResults = [
  { name: 'tiles' },
  { value: 'png' },
  { value: 'test-source' },
  { value: '0' },
  { value: '18' },
  null,
  null,
];

vi.mock('bun:sqlite', () => {
  return {
    Database: vi.fn(() => {
      let queryCallCount = 0;
      return {
        query: (_sql: string) => {
          queryCallCount++;
          return {
            get: () => {
              if (queryCallCount === 1) {
                return { name: 'tiles' };
              }
              if (queryCallCount === 2) {
                return { value: 'png' };
              }
              if (queryCallCount === 3) {
                return { value: 'test-source' };
              }
              if (queryCallCount >= 4 && queryCallCount <= 7) {
                return { value: String(queryCallCount) };
              }
              return dbBehavior.tileQueryResult;
            },
          };
        },
        close: () => {},
      };
    }),
  };
});

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(() => Promise.resolve([])),
}));

const handlers = createMbtilesServer({
  mbtilesDir: '/fake/mbtiles',
  port: 3001,
});

describe('createSourceLabel', () => {
  it('uses metadata name when provided and non-empty', () => {
    expect(createSourceLabel('test.mbtiles', 'Custom Label')).toBe(
      'Custom Label'
    );
  });

  it('trims whitespace from metadata name', () => {
    expect(createSourceLabel('test.mbtiles', '  Another Label  ')).toBe(
      'Another Label'
    );
  });

  it('falls back to basename without extension when metadata name is empty', () => {
    expect(createSourceLabel('my-source.mbtiles', '')).toBe('my-source');
  });

  it('falls back to basename when metadata name is only whitespace', () => {
    expect(createSourceLabel('my-source.mbtiles', '   ')).toBe('my-source');
  });

  it('falls back to basename when metadata name is null', () => {
    expect(createSourceLabel('my-source.mbtiles', null)).toBe('my-source');
  });

  it('strips .mbtiles extension from basename', () => {
    expect(createSourceLabel('source-file.mbtiles', null)).toBe(
      'source-file'
    );
  });
});

describe('parseTilePath', () => {
  it('parses a valid tile path correctly', () => {
    const result = parseTilePath('/api/mbtiles/china/5/12/8');
    expect(result).toEqual({ sourceId: 'china', z: 5, x: 12, y: 8 });
  });

  it('parses a source id with hyphens', () => {
    const result = parseTilePath('/api/mbtiles/china-beijing/3/1/2');
    expect(result).toEqual({
      sourceId: 'china-beijing',
      z: 3,
      x: 1,
      y: 2,
    });
  });

  it('parses source id with encoded characters', () => {
    const result = parseTilePath('/api/mbtiles/china%20beijing/2/0/1');
    expect(result).toEqual({
      sourceId: 'china beijing',
      z: 2,
      x: 0,
      y: 1,
    });
  });

  it('parses zero-valued coordinates', () => {
    const result = parseTilePath('/api/mbtiles/source/0/0/0');
    expect(result).toEqual({ sourceId: 'source', z: 0, x: 0, y: 0 });
  });

  it('returns null for non-tile paths', () => {
    expect(parseTilePath('/api/mbtiles/catalog')).toBeNull();
    expect(parseTilePath('/api/mbtiles/health')).toBeNull();
    expect(parseTilePath('/')).toBeNull();
    expect(parseTilePath('/api/mbtiles')).toBeNull();
  });

  it('returns null for paths with missing segments', () => {
    expect(parseTilePath('/api/mbtiles/source/5/12')).toBeNull();
    expect(parseTilePath('/api/mbtiles/source/5')).toBeNull();
    expect(parseTilePath('/api/mbtiles/source')).toBeNull();
  });

  it('returns null for paths with non-numeric tile coordinates', () => {
    expect(parseTilePath('/api/mbtiles/source/abc/1/2')).toBeNull();
    expect(parseTilePath('/api/mbtiles/source/1/nan/2')).toBeNull();
    expect(parseTilePath('/api/mbtiles/source/1/2/float')).toBeNull();
  });

  it('returns null for paths with extra segments', () => {
    expect(parseTilePath('/api/mbtiles/source/1/2/3/4')).toBeNull();
    expect(parseTilePath('/api/mbtiles/source/1/2/3/extra')).toBeNull();
  });

  it('returns null for unrecognised prefix', () => {
    expect(parseTilePath('/api/other/source/1/2/3')).toBeNull();
  });
});

describe('toByteArray', () => {
  it('returns Uint8Array unchanged', () => {
    const original = new Uint8Array([0x1a, 0x02, 0x18]);
    expect(toByteArray(original)).toBe(original);
  });

  it('wraps ArrayBuffer in Uint8Array', () => {
    const buffer = new ArrayBuffer(3);
    const result = toByteArray(buffer);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result?.length).toBe(3);
  });

  it('wraps TypedArrays (DataView) correctly', () => {
    const buffer = new ArrayBuffer(8);
    const dataView = new DataView(buffer, 2, 4);
    const result = toByteArray(dataView);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result?.length).toBe(4);
  });

  it('returns null for non-binary primitives', () => {
    expect(toByteArray(null)).toBeNull();
    expect(toByteArray(undefined)).toBeNull();
    expect(toByteArray('string')).toBeNull();
    expect(toByteArray(123)).toBeNull();
    expect(toByteArray({})).toBeNull();
  });
});

describe('isGzipCompressed', () => {
  it('returns true for gzip magic bytes', () => {
    const gzipHeader = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
    expect(isGzipCompressed(gzipHeader)).toBe(true);
  });

  it('returns false for plain protobuf bytes', () => {
    const pbfHeader = new Uint8Array([0x1a, 0x02, 0x18, 0x00]);
    expect(isGzipCompressed(pbfHeader)).toBe(false);
  });

  it('returns false for empty data', () => {
    expect(isGzipCompressed(new Uint8Array([]))).toBe(false);
  });

  it('returns false for single byte', () => {
    expect(isGzipCompressed(new Uint8Array([0x1f]))).toBe(false);
  });
});

describe('maybeDecompress', () => {
  it('passes through plain data when not gzip-compressed', () => {
    const plainData = new Uint8Array([0x1a, 0x02, 0x18, 0x00]);
    const result = maybeDecompress(plainData);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(plainData.length);
    expect(result[0]).toBe(0x1a);
  });

  it('decompresses gzip-compressed data correctly', async () => {
    const { gzipSync } = await import('node:zlib');
    const originalData = new Uint8Array([0x1a, 0x02, 0x18, 0x00, 0xff, 0xfe]);
    const compressed = gzipSync(originalData);
    expect(isGzipCompressed(compressed)).toBe(true);

    const decompressed = maybeDecompress(compressed);
    expect(Buffer.isBuffer(decompressed)).toBe(true);
    expect(decompressed.length).toBe(originalData.length);
    expect(Array.from(decompressed)).toEqual(Array.from(originalData));
  });

  it('isGzipCompressed guard correctly distinguishes compressed from plain', async () => {
    const { gzipSync } = await import('node:zlib');
    const plainData = new Uint8Array([0x1a, 0x02, 0x18, 0x00]);
    expect(isGzipCompressed(plainData)).toBe(false);

    const compressed = gzipSync(plainData);
    expect(isGzipCompressed(compressed)).toBe(true);
  });
});

describe('getMbtilesSourceType', () => {
  it('returns raster for png format', () => {
    expect(getMbtilesSourceType('png')).toBe('raster');
  });

  it('returns raster for jpg format', () => {
    expect(getMbtilesSourceType('jpg')).toBe('raster');
  });

  it('returns raster for webp format', () => {
    expect(getMbtilesSourceType('webp')).toBe('raster');
  });

  it('returns vector for pbf format', () => {
    expect(getMbtilesSourceType('pbf')).toBe('vector');
  });

  it('returns null for unknown format', () => {
    expect(getMbtilesSourceType('unknown')).toBeNull();
  });
});

describe('getMbtilesContentType', () => {
  it('returns correct protobuf content type for pbf', () => {
    expect(getMbtilesContentType('pbf')).toBe(
      'application/vnd.mapbox-vector-tile'
    );
  });

  it('returns correct content type for png', () => {
    expect(getMbtilesContentType('png')).toBe('image/png');
  });

  it('returns correct content type for jpg', () => {
    expect(getMbtilesContentType('jpg')).toBe('image/jpeg');
  });

  it('returns correct content type for jpeg', () => {
    expect(getMbtilesContentType('jpeg')).toBe('image/jpeg');
  });

  it('returns correct content type for webp', () => {
    expect(getMbtilesContentType('webp')).toBe('image/webp');
  });

  it('defaults to png for unknown formats', () => {
    expect(getMbtilesContentType('unknown')).toBe('image/png');
  });

  it('is case-insensitive for pbf', () => {
    expect(getMbtilesContentType('PBF')).toBe(
      'application/vnd.mapbox-vector-tile'
    );
    expect(getMbtilesContentType('Pbf')).toBe(
      'application/vnd.mapbox-vector-tile'
    );
  });
});

describe('extractVectorMetadata for catalog filtering', () => {
  it('usable pbf source with valid json returns vector layers', async () => {
    const { extractVectorMetadata } = await import(
      '../src/mbtiles/vector-metadata'
    );
    const json = JSON.stringify({
      vector_layers: [
        {
          id: 'roads',
          description: 'Road network',
          minzoom: 0,
          maxzoom: 14,
        },
      ],
    });
    const result = extractVectorMetadata({ value: json }, 'pbf');
    expect(result.usable).toBe(true);
    if (result.usable) {
      expect(result.vectorLayers).toHaveLength(1);
      expect(result.vectorLayers[0].id).toBe('roads');
    }
  });

  it('pbf source missing json is filtered out', async () => {
    const { extractVectorMetadata } = await import(
      '../src/mbtiles/vector-metadata'
    );
    const result = extractVectorMetadata(null, 'pbf');
    expect(result.usable).toBe(false);
  });

  it('pbf source with empty vector_layers is filtered out', async () => {
    const { extractVectorMetadata } = await import(
      '../src/mbtiles/vector-metadata'
    );
    const json = JSON.stringify({ vector_layers: [] });
    const result = extractVectorMetadata({ value: json }, 'pbf');
    expect(result.usable).toBe(false);
  });

  it('pbf source with malformed json is filtered out', async () => {
    const { extractVectorMetadata } = await import(
      '../src/mbtiles/vector-metadata'
    );
    const result = extractVectorMetadata({ value: 'not json' }, 'pbf');
    expect(result.usable).toBe(false);
  });

  it('raster source should not be processed as vector', async () => {
    const { parseVectorMetadata } = await import(
      '../src/mbtiles/vector-metadata'
    );
    const result = parseVectorMetadata('{"vector_layers":[]}', 'png');
    expect(result.usable).toBe(false);
  });
});

describe('catalog entry shape', () => {
  it('raster entry should have sourceType raster', () => {
    const rasterEntry: MbtilesCatalogSource = {
      id: 'test-raster',
      label: 'Test Raster',
      format: 'png',
      minZoom: 0,
      maxZoom: 18,
      bounds: [-180, -90, 180, 90],
      attribution: 'Local',
      sourceType: 'raster',
    };
    expect(rasterEntry.sourceType).toBe('raster');
    expect(rasterEntry.vectorLayers).toBeUndefined();
  });

  it('vector entry should have sourceType vector and vectorLayers', () => {
    const vectorLayers: MbtilesVectorLayer[] = [
      {
        id: 'layer1',
        description: 'Layer 1',
        minZoom: 0,
        maxZoom: 14,
      },
    ];
    const vectorEntry: MbtilesCatalogSource = {
      id: 'test-vector',
      label: 'Test Vector',
      format: 'pbf',
      minZoom: 0,
      maxZoom: 14,
      bounds: [-180, -90, 180, 90],
      attribution: 'Local',
      sourceType: 'vector',
      vectorLayers,
    };
    expect(vectorEntry.sourceType).toBe('vector');
    expect(vectorEntry.vectorLayers).toBeDefined();
    expect(vectorEntry.vectorLayers).toHaveLength(1);
    expect(vectorEntry.vectorLayers?.[0].id).toBe('layer1');
  });

  it('catalog response should include all required fields', () => {
    const sources: MbtilesCatalogSource[] = [
      {
        id: 'china',
        label: 'China',
        format: 'pbf',
        minZoom: 0,
        maxZoom: 14,
        bounds: [73, 18, 135, 54],
        attribution: 'Local',
        sourceType: 'vector',
        vectorLayers: [
          {
            id: 'provinces',
            description: ' provinces',
            minZoom: 3,
            maxZoom: 12,
          },
        ],
      },
    ];

    const response = { sources };

    expect(response.sources).toHaveLength(1);
    const source = response.sources[0];
    expect(source.id).toBe('china');
    expect(source.label).toBe('China');
    expect(source.format).toBe('pbf');
    expect(source.sourceType).toBe('vector');
    expect(source.vectorLayers).toBeDefined();
    expect(source.vectorLayers?.[0].id).toBe('provinces');
  });
});

describe('health handler', () => {
  it('returns 200 with available=true', () => {
    const response = handlers.health();
    expect(response.status).toBe(200);
  });

  it('response body has correct shape', async () => {
    const response = handlers.health();
    const body = (await response.json()) as {
      available: boolean;
      directory: string;
      port: number;
    };
    expect(body.available).toBe(true);
    expect(typeof body.directory).toBe('string');
    expect(typeof body.port).toBe('number');
  });

  it('sets Cache-Control: no-store header', () => {
    const response = handlers.health();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('buildCatalogResponse', () => {
  it('returns 200 with sources array', () => {
    const response = buildCatalogResponse([]);
    expect(response.status).toBe(200);
  });

  it('sets Cache-Control: no-store header', () => {
    const response = buildCatalogResponse([]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('catalog body has correct top-level shape', async () => {
    const response = buildCatalogResponse([]);
    const body = (await response.json()) as { sources: unknown[] };
    expect(Array.isArray(body.sources)).toBe(true);
  });

  it('raster entry omits vectorLayers field', async () => {
    const rasterSource: MbtilesCatalogSource = {
      id: 'test-raster',
      label: 'Test Raster',
      format: 'png',
      minZoom: 0,
      maxZoom: 18,
      bounds: [-180, -90, 180, 90],
      attribution: 'Local',
      sourceType: 'raster',
    };
    const response = buildCatalogResponse([rasterSource]);
    const body = (await response.json()) as {
      sources: MbtilesCatalogSource[];
    };
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].sourceType).toBe('raster');
    expect('vectorLayers' in body.sources[0]).toBe(false);
  });

  it('vector entry includes vectorLayers field', async () => {
    const vectorSource: MbtilesCatalogSource = {
      id: 'test-vector',
      label: 'Test Vector',
      format: 'pbf',
      minZoom: 0,
      maxZoom: 14,
      bounds: [-180, -90, 180, 90],
      attribution: 'Local',
      sourceType: 'vector',
      vectorLayers: [
        {
          id: 'layer1',
          description: 'Layer 1',
          minZoom: 0,
          maxZoom: 14,
        },
      ],
    };
    const response = buildCatalogResponse([vectorSource]);
    const body = (await response.json()) as {
      sources: MbtilesCatalogSource[];
    };
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].sourceType).toBe('vector');
    expect(body.sources[0].vectorLayers).toBeDefined();
    expect(body.sources[0].vectorLayers?.[0].id).toBe('layer1');
  });

  it('includes all required source fields in response', async () => {
    const sources: MbtilesCatalogSource[] = [
      {
        id: 'china',
        label: 'China',
        format: 'pbf',
        minZoom: 0,
        maxZoom: 14,
        bounds: [73, 18, 135, 54],
        attribution: 'Local',
        sourceType: 'vector',
        vectorLayers: [
          {
            id: 'provinces',
            description: ' provinces',
            minZoom: 3,
            maxZoom: 12,
          },
        ],
      },
    ];
    const response = buildCatalogResponse(sources);
    const body = (await response.json()) as {
      sources: MbtilesCatalogSource[];
    };
    const source = body.sources[0];
    expect(source.id).toBe('china');
    expect(source.label).toBe('China');
    expect(source.format).toBe('pbf');
    expect(source.sourceType).toBe('vector');
    expect(source.vectorLayers?.[0].id).toBe('provinces');
  });
});

describe('tile handler error branches', () => {
  beforeEach(() => {
    dbBehavior.tileQueryResult = null;
  });

  it('returns 404 when source is not found', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([]);
    const { tile } = createMbtilesServer({
      mbtilesDir: '/fake/empty',
      port: 3001,
    });
    const response = await tile('nonexistent', 0, 0, 0);
    expect(response.status).toBe(404);
  });

  it('returns 404 Tile not found when tile row is null', async () => {
    const { readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockResolvedValue([
      {
        isFile: () => true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'test.mbtiles' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parentPath: '.' as any,
        isDirectory: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
      },
    ]);
    dbBehavior.tileQueryResult = null;
    const { catalog, tile } = createMbtilesServer({
      mbtilesDir: '/fake/with-file',
      port: 3001,
    });
    const catalogResp = await catalog();
    const catalogBody = (await catalogResp.json()) as {
      sources: { id: string }[];
    };
    const actualId = catalogBody.sources[0]?.id;
    expect(actualId).toBeDefined();
    const response = await tile(actualId!, 0, 0, 0);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Tile not found');
  });
});
