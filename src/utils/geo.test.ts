/**
 * Geo utilities tests
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import type { Point } from '../state/store';

describe('utils/geo', () => {
  describe('equidistantResample', () => {
    it('should return empty array for empty input', async () => {
      const { equidistantResample } = await import('./geo');

      expect(equidistantResample([])).toEqual([]);
    });

    it('should return single point for single point input', async () => {
      const { equidistantResample } = await import('./geo');

      const points: Point[] = [{ lat: 30.0, lon: 120.0 }];
      const result = equidistantResample(points, 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(points[0]);
    });

    it('should return same points when total distance less than interval', async () => {
      const { equidistantResample } = await import('./geo');

      // 两点距离约 15 米，小于 10m 间隔（使用较大距离）
      const points: Point[] = [
        { lat: 30.0, lon: 120.0 },
        { lat: 30.0002, lon: 120.0 }, // 约 22 米
      ];
      const result = equidistantResample(points, 50);

      // 应该保留端点
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should insert points at specified interval', async () => {
      const { equidistantResample } = await import('./geo');

      // 创建一条约 100 米的线 (约 0.001 度 ≈ 111 米)
      const points: Point[] = [
        { lat: 30.0, lon: 120.0 },
        { lat: 30.001, lon: 120.0 },
      ];
      const result = equidistantResample(points, 10);

      // 100 米应该产生约 10 个点（每 10 米一个）
      expect(result.length).toBeGreaterThan(2);
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should always preserve endpoints', async () => {
      const { equidistantResample } = await import('./geo');

      const points: Point[] = [
        { lat: 0, lon: 0 },
        { lat: 0.01, lon: 0.01 },
        { lat: 0.02, lon: 0.02 },
      ];
      const result = equidistantResample(points, 5);

      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should handle longer route correctly', async () => {
      const { equidistantResample } = await import('./geo');

      // 创建一条约 500 米的折线
      const points: Point[] = [
        { lat: 30.0, lon: 120.0 },
        { lat: 30.005, lon: 120.0 },     // ~555m
        { lat: 30.005, lon: 120.005 },   // ~555m
        { lat: 30.01, lon: 120.005 },    // ~555m
      ];
      const result = equidistantResample(points, 50);

      // 应该插入了多个点
      expect(result.length).toBeGreaterThan(points.length);
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });
  });

  describe('equidistantResample path-following', () => {
    it('should not cut corners on L-shaped paths', async () => {
      const { equidistantResample, haversineDistance } = await import('./geo');

      // L-shaped: go north then east (right angle at vertex B)
      const A: Point = { lat: 30.0, lon: 120.0 };
      const B: Point = { lat: 30.01, lon: 120.0 };   // ~1.1 km north
      const C: Point = { lat: 30.01, lon: 120.01 };   // ~960 m east

      const result = equidistantResample([A, B, C], 100);

      // All resampled points should lie on one of the two segments, not off-path
      for (const p of result) {
        const dAB = haversineDistance(A, p) + haversineDistance(p, B);
        const dBC = haversineDistance(B, p) + haversineDistance(p, C);
        const lenAB = haversineDistance(A, B);
        const lenBC = haversineDistance(B, C);

        const onAB = Math.abs(dAB - lenAB) < 1; // within 1m tolerance
        const onBC = Math.abs(dBC - lenBC) < 1;
        expect(onAB || onBC).toBe(true);
      }
    });
  });

  describe('haversineDistance', () => {
    it('should handle antimeridian crossing', async () => {
      const { haversineDistance } = await import('./geo');

      const p1: Point = { lat: 0, lon: 179 };
      const p2: Point = { lat: 0, lon: -179 };

      const dist = haversineDistance(p1, p2);
      // 2 degrees at equator ≈ 222 km, not 358 degrees
      expect(dist).toBeLessThan(250000);
      expect(dist).toBeGreaterThan(200000);
    });

    it('should return 0 for identical points', async () => {
      const { haversineDistance } = await import('./geo');

      expect(haversineDistance({ lat: 45, lon: 90 }, { lat: 45, lon: 90 })).toBe(0);
    });
  });

  describe('calculateBearing', () => {
    it('should handle antimeridian crossing', async () => {
      const { calculateBearing } = await import('./geo');

      const bearing = calculateBearing({ lat: 0, lon: 179 }, { lat: 0, lon: -179 });
      // Should be roughly east (90°), not west
      expect(bearing).toBeGreaterThan(80);
      expect(bearing).toBeLessThan(100);
    });
  });

  describe('bearingToDirection', () => {
    it('should return N for NaN bearing', async () => {
      const { bearingToDirection } = await import('./geo');

      expect(bearingToDirection(NaN)).toBe('N');
    });

    it('should return correct compass directions', async () => {
      const { bearingToDirection } = await import('./geo');

      expect(bearingToDirection(0)).toBe('N');
      expect(bearingToDirection(90)).toBe('E');
      expect(bearingToDirection(180)).toBe('S');
      expect(bearingToDirection(270)).toBe('W');
    });
  });

  describe('visvalingamWhyattIndices', () => {
    it('should keep all indices when points are fewer than 3', async () => {
      const { visvalingamWhyattIndices } = await import('./geo');

      const points: Point[] = [
        { lat: 30.0, lon: 120.0 },
        { lat: 30.1, lon: 120.1 },
      ];

      expect(visvalingamWhyattIndices(points, 1)).toEqual([0, 1]);
    });

    it('should always preserve endpoints', async () => {
      const { visvalingamWhyattIndices } = await import('./geo');

      const points: Point[] = [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 0.5 },
        { lat: 2, lon: 1 },
        { lat: 3, lon: 1.5 },
        { lat: 4, lon: 2 },
      ];

      const indices = visvalingamWhyattIndices(points, 2);

      expect(indices[0]).toBe(0);
      expect(indices[indices.length - 1]).toBe(points.length - 1);
    });

    it('should reduce to target count when valid target provided', async () => {
      const { visvalingamWhyattIndices } = await import('./geo');

      const points: Point[] = [
        { lat: 0, lon: 0 },
        { lat: 0.2, lon: 1 },
        { lat: 0.4, lon: 2 },
        { lat: 1.2, lon: 3 },
        { lat: 0.8, lon: 4 },
        { lat: 1.0, lon: 5 },
        { lat: 1.1, lon: 6 },
        { lat: 1.0, lon: 7 },
        { lat: 1.2, lon: 8 },
        { lat: 1.3, lon: 9 },
      ];

      const target = Math.ceil(points.length * 0.2);
      const indices = visvalingamWhyattIndices(points, target);

      expect(indices.length).toBe(target);
    });

    it('should reduce collinear points while preserving endpoints', async () => {
      const { visvalingamWhyattIndices } = await import('./geo');

      const points: Point[] = [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 1 },
        { lat: 2, lon: 2 },
        { lat: 3, lon: 3 },
        { lat: 4, lon: 4 },
      ];

      const indices = visvalingamWhyattIndices(points, 2);

      expect(indices).toEqual([0, 4]);
    });

    it('should return sorted, unique, valid indices', async () => {
      const { visvalingamWhyattIndices } = await import('./geo');

      const points: Point[] = [
        { lat: 0, lon: 0 },
        { lat: 1, lon: 0.1 },
        { lat: 2, lon: 0.2 },
        { lat: 2.2, lon: 1.3 },
        { lat: 2.1, lon: 2.4 },
        { lat: 2.0, lon: 3.5 },
        { lat: 1.9, lon: 4.6 },
      ];

      const indices = visvalingamWhyattIndices(points, 4);

      const sorted = [...indices].sort((a, b) => a - b);
      const unique = new Set(indices);

      expect(indices).toEqual(sorted);
      expect(unique.size).toBe(indices.length);
      expect(indices.every((i) => i >= 0 && i < points.length)).toBe(true);
    });
  });
});
