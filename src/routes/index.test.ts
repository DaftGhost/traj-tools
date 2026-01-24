/**
 * 航线管理模块测试
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store, Point } from '../state/store';

// Mock the geometry module functions
vi.mock('./geometry', () => ({
  updateRouteDisplayGeometry: vi.fn(),
  setUIRefreshFunctions: vi.fn(),
  refreshRoutesList: vi.fn(),
  updatePropertiesPanel: vi.fn(),
}));

// Mock the map module
vi.mock('../map', () => ({
  fitRoute: vi.fn(),
}));

// Mock the heatmap module
vi.mock('../tools/heatmap', () => ({
  initRouteHeatOptions: vi.fn(),
}));

describe('mergeRoutes', () => {
  beforeEach(() => {
    // Clear routes before each test
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
  });

  it('should merge two routes by appending points', async () => {
    // Import after mocks are set up
    const { addRoute, mergeRoutes } = await import('./index');

    const points1: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
    ];
    const points2: Point[] = [
      { lat: 30.2, lon: 120.2 },
      { lat: 30.3, lon: 120.3 },
    ];

    const route1 = addRoute('Route1', points1);
    const route2 = addRoute('Route2', points2);

    const mergedRoute = mergeRoutes(route1.id, route2.id);

    expect(mergedRoute).not.toBeNull();
    expect(mergedRoute!.points.length).toBe(4);
    expect(mergedRoute!.points[0]).toEqual({ lat: 30.0, lon: 120.0 });
    expect(mergedRoute!.points[1]).toEqual({ lat: 30.1, lon: 120.1 });
    expect(mergedRoute!.points[2]).toEqual({ lat: 30.2, lon: 120.2 });
    expect(mergedRoute!.points[3]).toEqual({ lat: 30.3, lon: 120.3 });
  });

  it('should remove the second route after merging', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route1 = addRoute('Route1', [{ lat: 30.0, lon: 120.0 }]);
    const route2 = addRoute('Route2', [{ lat: 30.1, lon: 120.1 }]);

    expect(store.routes.length).toBe(2);

    mergeRoutes(route1.id, route2.id);

    expect(store.routes.length).toBe(1);
    expect(store.getRouteById(route2.id)).toBeUndefined();
  });

  it('should keep the first route after merging', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route1 = addRoute('Route1', [{ lat: 30.0, lon: 120.0 }]);
    const route2 = addRoute('Route2', [{ lat: 30.1, lon: 120.1 }]);

    mergeRoutes(route1.id, route2.id);

    expect(store.getRouteById(route1.id)).toBeDefined();
    expect(store.getRouteById(route1.id)!.name).toBe('Route1');
  });

  it('should return null when first route does not exist', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route2 = addRoute('Route2', [{ lat: 30.1, lon: 120.1 }]);

    const result = mergeRoutes('non-existent-id', route2.id);

    expect(result).toBeNull();
  });

  it('should return null when second route does not exist', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route1 = addRoute('Route1', [{ lat: 30.0, lon: 120.0 }]);

    const result = mergeRoutes(route1.id, 'non-existent-id');

    expect(result).toBeNull();
  });

  it('should return null when merging a route with itself', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route1 = addRoute('Route1', [{ lat: 30.0, lon: 120.0 }]);

    const result = mergeRoutes(route1.id, route1.id);

    expect(result).toBeNull();
  });

  it('should clear distance cache after merging', async () => {
    const { addRoute, mergeRoutes } = await import('./index');

    const route1 = addRoute('Route1', [{ lat: 30.0, lon: 120.0 }]);
    const route2 = addRoute('Route2', [{ lat: 30.1, lon: 120.1 }]);

    // Manually set a distance cache
    route1._distCache = [0, 1000];

    mergeRoutes(route1.id, route2.id);

    expect(route1._distCache).toBeUndefined();
  });
});
