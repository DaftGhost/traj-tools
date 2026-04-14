import { describe, expect, it } from 'vitest';
import {
  extractMetadataJson,
  extractVectorMetadata,
  getUnusableReasonText,
  parseVectorMetadata,
  type NormalizedVectorLayer,
  type UnusableReason,
  type VectorMetadataResult,
} from './vector-metadata';

function asUnusable(
  result: VectorMetadataResult
): asserts result is { usable: false; reason: UnusableReason } {
  if (result.usable) throw new Error('Expected unusable result');
}

function asUsable(
  result: VectorMetadataResult
): asserts result is { usable: true; vectorLayers: NormalizedVectorLayer[] } {
  if (!result.usable) throw new Error('Expected usable result');
}

describe('mbtiles/vector-metadata', () => {
  describe('parseVectorMetadata', () => {
    it('returns unusable for non-pbf format', () => {
      const result = parseVectorMetadata('{"vector_layers":[]}', 'png');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('not_vector_format');
    });

    it('returns unusable for uppercase PBF with empty layers', () => {
      const result = parseVectorMetadata('{"vector_layers":[]}', 'PBF');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('empty_vector_layers');
    });

    it('returns unusable when metadata json is null', () => {
      const result = parseVectorMetadata(null, 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('missing_metadata_json');
    });

    it('returns unusable when metadata json is empty string', () => {
      const result = parseVectorMetadata('', 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('missing_metadata_json');
    });

    it('returns unusable when metadata json is whitespace only', () => {
      const result = parseVectorMetadata('   ', 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('missing_metadata_json');
    });

    it('returns unusable when metadata json is malformed', () => {
      const result = parseVectorMetadata('not valid json {', 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('malformed_metadata_json');
    });

    it('returns unusable when vector_layers field is missing', () => {
      const result = parseVectorMetadata(
        '{"name":"test","description":"a map"}',
        'pbf'
      );
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('missing_vector_layers');
    });

    it('returns unusable when vector_layers is not an array', () => {
      const result = parseVectorMetadata(
        '{"vector_layers":{"id":"layer1"}}',
        'pbf'
      );
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('malformed_vector_layers');
    });

    it('returns unusable when vector_layers is empty array', () => {
      const result = parseVectorMetadata('{"vector_layers":[]}', 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('empty_vector_layers');
    });

    it('returns unusable when layer is missing id', () => {
      const result = parseVectorMetadata(
        '{"vector_layers":[{"description":"test"}]}',
        'pbf'
      );
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('malformed_vector_layers');
    });

    it('returns unusable when layer id is empty string', () => {
      const result = parseVectorMetadata(
        '{"vector_layers":[{"id":"  ","description":"test"}]}',
        'pbf'
      );
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('malformed_vector_layers');
    });

    it('returns unusable when layer has invalid zoom type', () => {
      const result = parseVectorMetadata(
        '{"vector_layers":[{"id":"layer1","minzoom":"invalid"}]}',
        'pbf'
      );
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('malformed_vector_layers');
    });

    it('returns usable with normalized layers for valid minimal input', () => {
      const result = parseVectorMetadata(
        '{"vector_layers":[{"id":"roads"}]}',
        'pbf'
      );
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers).toEqual([
        { id: 'roads', description: '', minZoom: 0, maxZoom: 22 },
      ]);
    });

    it('returns usable with full metadata', () => {
      const json = JSON.stringify({
        vector_layers: [
          {
            id: ' provinces',
            description: ' Province boundaries ',
            minzoom: 3,
            maxzoom: 12,
          },
        ],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers).toEqual([
        {
          id: 'provinces',
          description: 'Province boundaries',
          minZoom: 3,
          maxZoom: 12,
        },
      ]);
    });

    it('normalizes id and description whitespace', () => {
      const json = JSON.stringify({
        vector_layers: [{ id: '  layer1  ', description: '  desc  ' }],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].id).toBe('layer1');
      expect(result.vectorLayers[0].description).toBe('desc');
    });

    it('clamps maxZoom to 22', () => {
      const json = JSON.stringify({
        vector_layers: [{ id: 'layer1', maxzoom: 30 }],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].maxZoom).toBe(22);
    });

    it('clamps negative minZoom to 0', () => {
      const json = JSON.stringify({
        vector_layers: [{ id: 'layer1', minzoom: -5 }],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].minZoom).toBe(0);
    });

    it('normalizes minZoom if greater than maxZoom', () => {
      const json = JSON.stringify({
        vector_layers: [{ id: 'layer1', minzoom: 15, maxzoom: 5 }],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].minZoom).toBe(0);
      expect(result.vectorLayers[0].maxZoom).toBe(15);
    });

    it('accepts non-integer zoom values', () => {
      const json = JSON.stringify({
        vector_layers: [{ id: 'layer1', minzoom: 2.7, maxzoom: 14.3 }],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].minZoom).toBe(2);
      expect(result.vectorLayers[0].maxZoom).toBe(14);
    });

    it('handles multiple layers', () => {
      const json = JSON.stringify({
        vector_layers: [
          { id: 'roads', description: 'Road network' },
          { id: 'water', minzoom: 4, maxzoom: 16 },
          { id: 'parks', description: 'Green spaces', minzoom: 8, maxzoom: 18 },
        ],
      });
      const result = parseVectorMetadata(json, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers).toHaveLength(3);
      expect(result.vectorLayers[0]).toEqual({
        id: 'roads',
        description: 'Road network',
        minZoom: 0,
        maxZoom: 22,
      });
      expect(result.vectorLayers[1]).toEqual({
        id: 'water',
        description: '',
        minZoom: 4,
        maxZoom: 16,
      });
      expect(result.vectorLayers[2]).toEqual({
        id: 'parks',
        description: 'Green spaces',
        minZoom: 8,
        maxZoom: 18,
      });
    });
  });

  describe('extractMetadataJson', () => {
    it('returns null for null row', () => {
      expect(extractMetadataJson(null)).toBeNull();
    });

    it('returns null for undefined row', () => {
      expect(extractMetadataJson(undefined)).toBeNull();
    });

    it('returns null when value is not a string', () => {
      expect(extractMetadataJson({ value: 123 })).toBeNull();
      expect(extractMetadataJson({ value: null })).toBeNull();
      expect(extractMetadataJson({ value: { foo: 'bar' } })).toBeNull();
    });

    it('returns null when value is empty string', () => {
      expect(extractMetadataJson({ value: '' })).toBeNull();
    });

    it('returns the string value when present', () => {
      const json = '{"vector_layers":[]}';
      expect(extractMetadataJson({ value: json })).toBe(json);
    });

    it('returns the string value when value is whitespace', () => {
      const json = '  {"vector_layers":[]}  ';
      expect(extractMetadataJson({ value: json })).toBe(json);
    });

    it('handles Uint8Array as returned by bun:sqlite', () => {
      const encoder = new TextEncoder();
      const uint8 = encoder.encode('{"vector_layers":[]}');
      expect(extractMetadataJson({ value: uint8 })).toBeNull();
    });
  });

  describe('extractVectorMetadata', () => {
    it('combines row extraction and parsing', () => {
      const row = { value: '{"vector_layers":[{"id":"layer1"}]}' };
      const result = extractVectorMetadata(row, 'pbf');
      expect(result.usable).toBe(true);
      asUsable(result);
      expect(result.vectorLayers[0].id).toBe('layer1');
    });

    it('handles null row with pbf format', () => {
      const result = extractVectorMetadata(null, 'pbf');
      expect(result.usable).toBe(false);
      asUnusable(result);
      expect(result.reason).toBe('missing_metadata_json');
    });
  });

  describe('getUnusableReasonText', () => {
    const cases: UnusableReason[] = [
      'not_vector_format',
      'missing_metadata_json',
      'malformed_metadata_json',
      'missing_vector_layers',
      'empty_vector_layers',
      'malformed_vector_layers',
    ];

    it('returns a non-empty string for all reason types', () => {
      for (const reason of cases) {
        expect(getUnusableReasonText(reason)).toBeTruthy();
        expect(typeof getUnusableReasonText(reason)).toBe('string');
      }
    });

    it('returns format-specific text for not_vector_format', () => {
      expect(getUnusableReasonText('not_vector_format')).toBe(
        'format is not pbf'
      );
    });

    it('returns distinct texts for each reason', () => {
      const texts = cases.map(getUnusableReasonText);
      const unique = new Set(texts);
      expect(unique.size).toBe(cases.length);
    });
  });
});
