/**
 * Geo utilities tests
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import type { Point } from '../state/store';

describe('utils/geo', () => {
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
