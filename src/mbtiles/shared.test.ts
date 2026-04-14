import { describe, expect, it } from 'vitest';
import {
  buildMbtilesSourceId,
  getMbtilesSourceType,
  getMbtilesTileRow,
  isSupportedMbtilesFormat,
  parseMbtilesBounds,
} from './shared';

describe('mbtiles/shared', () => {
  it('converts XYZ rows to MBTiles tile rows', () => {
    expect(getMbtilesTileRow(0, 0)).toBe(0);
    expect(getMbtilesTileRow(3, 0)).toBe(7);
    expect(getMbtilesTileRow(11, 791)).toBe(1256);
  });

  it('builds stable source ids from file names', () => {
    const used = new Set<string>();

    expect(buildMbtilesSourceId('China Topo.mbtiles', used)).toBe('china-topo');
    expect(buildMbtilesSourceId('China Topo.mbtiles', used)).toMatch(
      /^china-topo-[a-z0-9]+$/
    );
    expect(buildMbtilesSourceId(' 复杂 地图.mbtiles', used)).toMatch(
      /^mbtiles-[a-z0-9]+$/
    );
    expect(buildMbtilesSourceId('A B.mbtiles', new Set(['a-b']))).toBe(
      buildMbtilesSourceId('A B.mbtiles', new Set(['a-b']))
    );
  });

  it('parses valid bounds strings', () => {
    expect(parseMbtilesBounds('73.0,18.0,135.0,54.0')).toEqual([
      73.0, 18.0, 135.0, 54.0,
    ]);
    expect(parseMbtilesBounds('bad')).toBeNull();
    expect(parseMbtilesBounds(null)).toBeNull();
  });

  it('recognizes supported raster formats', () => {
    expect(isSupportedMbtilesFormat('png')).toBe(true);
    expect(isSupportedMbtilesFormat('JPEG')).toBe(true);
    expect(isSupportedMbtilesFormat('webp')).toBe(true);
  });

  it('recognizes supported vector formats', () => {
    expect(isSupportedMbtilesFormat('pbf')).toBe(true);
    expect(isSupportedMbtilesFormat('PBF')).toBe(true);
  });

  it('rejects unsupported formats', () => {
    expect(isSupportedMbtilesFormat('json')).toBe(false);
    expect(isSupportedMbtilesFormat('')).toBe(false);
  });

  it('classifies source type deterministically', () => {
    expect(getMbtilesSourceType('png')).toBe('raster');
    expect(getMbtilesSourceType('jpeg')).toBe('raster');
    expect(getMbtilesSourceType('JPEG')).toBe('raster');
    expect(getMbtilesSourceType('webp')).toBe('raster');
    expect(getMbtilesSourceType('pbf')).toBe('vector');
    expect(getMbtilesSourceType('PBF')).toBe('vector');
    expect(getMbtilesSourceType('json')).toBe(null);
    expect(getMbtilesSourceType('')).toBe(null);
  });
});
