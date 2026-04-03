/**
 * Snap utilities tests
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { store, type Point } from '../state/store';
import type { SnapRef } from '../types/refs';

describe('utils/snap', () => {
  describe('distanceMeters', () => {
    it('should calculate distance between two points', async () => {
      const { distanceMeters } = await import('./snap');

      const p1: Point = { lat: 30.0, lon: 120.0 };
      const p2: Point = { lat: 30.1, lon: 120.1 };

      const distance = distanceMeters(p1, p2);

      // Distance should be approximately 14.7 km (rough calculation)
      expect(distance).toBeGreaterThan(14000);
      expect(distance).toBeLessThan(15500);
    });

    it('should return 0 for same points', async () => {
      const { distanceMeters } = await import('./snap');

      const p: Point = { lat: 30.0, lon: 120.0 };

      const distance = distanceMeters(p, p);

      expect(distance).toBe(0);
    });

    it('should handle short distances', async () => {
      const { distanceMeters } = await import('./snap');

      const p1: Point = { lat: 30.0, lon: 120.0 };
      const p2: Point = { lat: 30.001, lon: 120.0 };

      const distance = distanceMeters(p1, p2);

      // Approximately 111 meters
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(120);
    });

    it('should handle antipodal points approximately', async () => {
      const { distanceMeters } = await import('./snap');

      const p1: Point = { lat: 0, lon: 0 };
      const p2: Point = { lat: 0, lon: 180 };

      // Half the Earth's circumference
      const distance = distanceMeters(p1, p2);

      expect(distance).toBeGreaterThan(20000000);
      expect(distance).toBeLessThan(20040000);
    });
  });

  describe('sqSegDist', () => {
    it('should return 0 for point on segment start', async () => {
      const { sqSegDist } = await import('./snap');

      const point: Point = { lat: 0, lon: 0 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 1, lon: 1 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      expect(distance).toBe(0);
    });

    it('should return 0 for point on segment end', async () => {
      const { sqSegDist } = await import('./snap');

      const point: Point = { lat: 1, lon: 1 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 1, lon: 1 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      expect(distance).toBe(0);
    });

    it('should calculate perpendicular distance', async () => {
      const { sqSegDist } = await import('./snap');

      // Point at (0.5, 0), line from (0,0) to (1,1)
      const point: Point = { lat: 0.5, lon: 0 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 1, lon: 1 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      // The line from (0,0) to (1,1) has direction vector (1,1)
      // The perpendicular from (0.5, 0) to this line projects to t=0.25
      // Point on line at t=0.25 is (0.25, 0.25)
      // Distance squared = (0.5-0.25)^2 + (0-0.25)^2 = 0.0625 + 0.0625 = 0.125
      expect(distance).toBeCloseTo(0.125, 5);
    });

    it('should handle zero-length segment', async () => {
      const { sqSegDist } = await import('./snap');

      const point: Point = { lat: 1, lon: 1 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 0, lon: 0 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      // Distance from point to the single point
      expect(distance).toBe(2); // (1-0)^2 + (1-0)^2 = 2
    });

    it('should handle point before segment', async () => {
      const { sqSegDist } = await import('./snap');

      const point: Point = { lat: -1, lon: -1 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 1, lon: 1 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      // Distance from point to line start
      expect(distance).toBe(2); // (-1-0)^2 + (-1-0)^2 = 2
    });

    it('should handle point after segment', async () => {
      const { sqSegDist } = await import('./snap');

      const point: Point = { lat: 2, lon: 2 };
      const lineStart: Point = { lat: 0, lon: 0 };
      const lineEnd: Point = { lat: 1, lon: 1 };

      const distance = sqSegDist(point, lineStart, lineEnd);

      // Distance from point to line end
      expect(distance).toBe(2); // (2-1)^2 + (2-1)^2 = 2
    });
  });

  describe('pointToSegmentDistance', () => {
    it('should return distance to closest endpoint when outside segment', async () => {
      const { pointToSegmentDistance } = await import('./snap');

      const segStart: Point = { lat: 0, lon: 0 };
      const segEnd: Point = { lat: 1, lon: 0 };

      // Point is at lat 2, closest to segEnd
      const distance = pointToSegmentDistance(2, 0, segStart, segEnd);

      // Distance from (2,0) to (1,0) is 1 degree (~111km)
      expect(distance).toBeGreaterThan(100000);
      expect(distance).toBeLessThan(120000);
    });

    it('should return perpendicular distance when point projects onto segment', async () => {
      const { pointToSegmentDistance } = await import('./snap');

      const segStart: Point = { lat: 0, lon: 0 };
      const segEnd: Point = { lat: 1, lon: 1 };

      // Point at (0.5, 0) - projects to (0.25, 0.25)
      const distance = pointToSegmentDistance(0.5, 0, segStart, segEnd);

      // Perpendicular distance from (0.5, 0) to (0.25, 0.25) is ~0.354 degrees ~39.3km
      expect(distance).toBeGreaterThan(35000);
      expect(distance).toBeLessThan(45000);
    });

    it('should handle zero-length segment', async () => {
      const { pointToSegmentDistance } = await import('./snap');

      const segStart: Point = { lat: 30, lon: 120 };
      const segEnd: Point = { lat: 30, lon: 120 };

      const distance = pointToSegmentDistance(30.1, 120, segStart, segEnd);

      // Distance from point to the single point
      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeLessThan(12000);
    });

    it('should handle vertical segment', async () => {
      const { pointToSegmentDistance } = await import('./snap');

      const segStart: Point = { lat: 30, lon: 120 };
      const segEnd: Point = { lat: 31, lon: 120 };

      // Point at lat 30.5, lon 120.1 - closest to segment at (30.5, 120)
      const distance = pointToSegmentDistance(30.5, 120.1, segStart, segEnd);

      // Horizontal distance 0.1 degrees at latitude 30 ~9.5km
      expect(distance).toBeGreaterThan(8000);
      expect(distance).toBeLessThan(11000);
    });

    it('should handle horizontal segment', async () => {
      const { pointToSegmentDistance } = await import('./snap');

      const segStart: Point = { lat: 30, lon: 120 };
      const segEnd: Point = { lat: 30, lon: 121 };

      // Point at lat 30.1, lon 120.5
      const distance = pointToSegmentDistance(30.1, 120.5, segStart, segEnd);

      // Vertical distance 0.1 degrees ~11km
      expect(distance).toBeGreaterThan(10000);
      expect(distance).toBeLessThan(12000);
    });
  });

  describe('getSnapGeometry', () => {
    it('should include per-route pointIdx for each segment', async () => {
      const { getSnapGeometry } = await import('./snap');

      // Set up store with two routes
      store.routes = [
        {
          id: 'r1',
          name: 'R1',
          color: '#f00',
          editable: false,
          visible: true,
          selected: false,
          points: [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
            { lat: 2, lon: 0 },
          ],
          _display: {
            simplified: [
              { lat: 0, lon: 0 },
              { lat: 1, lon: 0 },
              { lat: 2, lon: 0 },
            ],
            layer: null,
            markers: [],
          },
        },
        {
          id: 'r2',
          name: 'R2',
          color: '#0f0',
          editable: false,
          visible: true,
          selected: false,
          points: [
            { lat: 10, lon: 10 },
            { lat: 11, lon: 10 },
            { lat: 12, lon: 10 },
            { lat: 13, lon: 10 },
          ],
          _display: {
            simplified: [
              { lat: 10, lon: 10 },
              { lat: 11, lon: 10 },
              { lat: 12, lon: 10 },
              { lat: 13, lon: 10 },
            ],
            layer: null,
            markers: [],
          },
        },
      ] as unknown as typeof store.routes;

      const segs = getSnapGeometry();

      // Route 1: 2 segments (indices 0,1), Route 2: 3 segments (indices 0,1,2)
      expect(segs).toHaveLength(5);

      // Route 1 segments should have pointIdx 0 and 1
      expect(segs[0].routeId).toBe('r1');
      expect(segs[0].pointIdx).toBe(0);
      expect(segs[1].routeId).toBe('r1');
      expect(segs[1].pointIdx).toBe(1);

      // Route 2 segments should have pointIdx 0, 1, 2 (not 2, 3, 4)
      expect(segs[2].routeId).toBe('r2');
      expect(segs[2].pointIdx).toBe(0);
      expect(segs[3].routeId).toBe('r2');
      expect(segs[3].pointIdx).toBe(1);
      expect(segs[4].routeId).toBe('r2');
      expect(segs[4].pointIdx).toBe(2);
    });

    it('should include closing segments and hole segments for polygons', async () => {
      const { getSnapGeometry } = await import('./snap');

      store.routes = [
        {
          id: 'poly-1',
          name: 'Polygon',
          color: '#00f',
          editable: false,
          visible: true,
          selected: false,
          geometryType: 'polygon',
          points: [
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
            { lat: 1, lon: 0 },
          ],
          holes: [
            [
              { lat: 0.2, lon: 0.2 },
              { lat: 0.2, lon: 0.4 },
              { lat: 0.4, lon: 0.4 },
              { lat: 0.4, lon: 0.2 },
            ],
          ],
          _display: {
            simplified: [
              { lat: 0, lon: 0 },
              { lat: 0, lon: 1 },
              { lat: 1, lon: 1 },
              { lat: 1, lon: 0 },
            ],
            holes: [
              [
                { lat: 0.2, lon: 0.2 },
                { lat: 0.2, lon: 0.4 },
                { lat: 0.4, lon: 0.4 },
                { lat: 0.4, lon: 0.2 },
              ],
            ],
            layer: null,
            markers: [],
          },
        },
      ] as unknown as typeof store.routes;

      const segs = getSnapGeometry();

      expect(segs).toHaveLength(8);
      expect(
        segs.some(
          (seg) =>
            seg.routeId === 'poly-1' &&
            seg.pointIdx === 3 &&
            seg.ringIndex === 0
        )
      ).toBe(true);
      expect(
        segs.some(
          (seg) =>
            seg.routeId === 'poly-1' &&
            seg.pointIdx === 3 &&
            seg.ringIndex === 1
        )
      ).toBe(true);
    });

    it('should skip point geometry routes when building segments', async () => {
      const { getSnapGeometry } = await import('./snap');

      store.routes = [
        {
          id: 'point-1',
          name: 'Point Route',
          color: '#00f',
          editable: false,
          visible: true,
          selected: false,
          geometryType: 'point',
          points: [
            { lat: 30, lon: 120 },
            { lat: 30.1, lon: 120.1 },
          ],
          _display: {
            simplified: [
              { lat: 30, lon: 120 },
              { lat: 30.1, lon: 120.1 },
            ],
            layer: null,
            markers: [],
          },
        },
      ] as unknown as typeof store.routes;

      expect(getSnapGeometry()).toEqual([]);
    });
  });

  describe('snapToRoutes', () => {
    it('should snap to point geometry vertices even without segments', async () => {
      const { snapToRoutes } = await import('./snap');

      store.map = {
        getZoom: () => 14,
      } as never;
      store.routes = [
        {
          id: 'point-1',
          name: 'Point Route',
          color: '#00f',
          editable: false,
          visible: true,
          selected: false,
          geometryType: 'point',
          points: [{ lat: 30, lon: 120 }],
        },
      ] as unknown as typeof store.routes;

      const snapped = snapToRoutes({ lat: 30.00001, lng: 120.00001 } as never);

      expect(snapped).toMatchObject({
        lat: 30,
        lon: 120,
        ref: {
          routeId: 'point-1',
          segIdx: 0,
          segFrac: 0,
        },
      });
    });
  });

  describe('SnapRef interface', () => {
    it('should create valid SnapRef object', () => {
      const ref: SnapRef = {
        routeId: 'route-123',
        ringIndex: 1,
        segIdx: 5,
        segFrac: 0.5,
      };

      expect(ref.routeId).toBe('route-123');
      expect(ref.ringIndex).toBe(1);
      expect(ref.segIdx).toBe(5);
      expect(ref.segFrac).toBe(0.5);
    });

    it('should handle edge cases for segFrac', () => {
      const refStart: SnapRef = {
        routeId: 'route-1',
        segIdx: 0,
        segFrac: 0,
      };

      const refEnd: SnapRef = {
        routeId: 'route-1',
        segIdx: 0,
        segFrac: 1,
      };

      expect(refStart.segFrac).toBe(0);
      expect(refEnd.segFrac).toBe(1);
    });
  });
});
