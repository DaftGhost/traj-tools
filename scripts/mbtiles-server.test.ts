import { describe, expect, it, vi } from 'vitest';
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
  extractVectorMetadata,
  parseVectorMetadata,
} from '../src/mbtiles/vector-metadata';

vi.mock('../scripts/mbtiles-server', () => ({
  createSourceLabel: vi.fn((fileName: string, metadataName: string | null) => {
    const trimmedName = metadataName?.trim();
    if (trimmedName) return trimmedName;
    const name = fileName.replace(/\.mbtiles$/i, '');
    const baseName = name.replace(/\.[^.]+$/, '');
    return baseName || 'mbtiles';
  }),
}));

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

describe('mbtiles-server catalog behavior', () => {
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

  describe('extractVectorMetadata for catalog filtering', () => {
    it('usable pbf source with valid json returns vector layers', () => {
      const json = JSON.stringify({
        vector_layers: [
          { id: 'roads', description: 'Road network', minzoom: 0, maxzoom: 14 },
        ],
      });
      const result = extractVectorMetadata({ value: json }, 'pbf');
      expect(result.usable).toBe(true);
      if (result.usable) {
        expect(result.vectorLayers).toHaveLength(1);
        expect(result.vectorLayers[0].id).toBe('roads');
      }
    });

    it('pbf source missing json is filtered out', () => {
      const result = extractVectorMetadata(null, 'pbf');
      expect(result.usable).toBe(false);
    });

    it('pbf source with empty vector_layers is filtered out', () => {
      const json = JSON.stringify({ vector_layers: [] });
      const result = extractVectorMetadata({ value: json }, 'pbf');
      expect(result.usable).toBe(false);
    });

    it('pbf source with malformed json is filtered out', () => {
      const result = extractVectorMetadata({ value: 'not json' }, 'pbf');
      expect(result.usable).toBe(false);
    });

    it('raster source should not be processed as vector', () => {
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
        { id: 'layer1', description: 'Layer 1', minZoom: 0, maxZoom: 14 },
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

  describe('getMbtilesContentType for tile responses', () => {
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
});
