/**
 * Route display simplification fallback tests
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Point, Route } from '../state/store';

vi.mock('leaflet', () => {
  function createLayer() {
    return {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      redraw: vi.fn(),
      getLatLngs: vi.fn().mockReturnValue([]),
    };
  }

  return {
    default: {
      polyline: vi.fn(() => createLayer()),
      polygon: vi.fn(() => createLayer()),
      circleMarker: vi.fn(() => createLayer()),
      featureGroup: vi.fn(() => createLayer()),
      latLng: vi.fn((lat: number, lon: number) => ({ lat, lng: lon })),
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      divIcon: vi.fn((opts: unknown) => opts),
    },
    polyline: vi.fn(() => createLayer()),
    polygon: vi.fn(() => createLayer()),
    circleMarker: vi.fn(() => createLayer()),
    featureGroup: vi.fn(() => createLayer()),
    latLng: vi.fn((lat: number, lon: number) => ({ lat, lng: lon })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    divIcon: vi.fn((opts: unknown) => opts),
  };
});

function createRoute(points: Point[]): Route {
  return {
    id: 'route-1',
    name: 'Route 1',
    points,
    color: '#1E88E5',
    editable: false,
    visible: true,
    selected: false,
    holes: [],
  };
}

describe('routes/geometry display simplification', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('../utils/geo');
  });

  it('uses raw polyline points when VW returns invalid indices', async () => {
    vi.doMock('../utils/geo', async () => {
      const actual =
        await vi.importActual<typeof import('../utils/geo')>('../utils/geo');
      return {
        ...actual,
        visvalingamWhyattIndices: vi.fn(() => [-1]),
      };
    });

    const { updateRouteDisplayGeometry } = await import('./geometry');
    const { store } = await import('../state/store');
    const points: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ];
    const route = createRoute(points);
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;

    updateRouteDisplayGeometry(route);

    expect(route._display?.simplified).toEqual(points);
    expect(route._display?.simplified).not.toBe(points);
  });

  it('uses raw polygon rings when VW returns invalid indices', async () => {
    vi.doMock('../utils/geo', async () => {
      const actual =
        await vi.importActual<typeof import('../utils/geo')>('../utils/geo');
      return {
        ...actual,
        visvalingamWhyattIndices: vi.fn(() => [-1]),
      };
    });

    const { updateRouteDisplayGeometry } = await import('./geometry');
    const { store } = await import('../state/store');
    const outer: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.2 },
      { lat: 30.2, lon: 120.2 },
      { lat: 30.2, lon: 120.0 },
      { lat: 30.1, lon: 119.9 },
    ];
    const hole: Point[] = [
      { lat: 30.05, lon: 120.05 },
      { lat: 30.05, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.1, lon: 120.05 },
    ];
    const route = createRoute(outer);
    route.geometryType = 'polygon';
    route.holes = [hole];
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;

    updateRouteDisplayGeometry(route);

    expect(route._display?.simplified).toEqual(outer);
    expect(route._display?.simplified).not.toBe(outer);
    expect(route._display?.holes).toEqual([hole]);
    expect(route._display?.holes?.[0]).not.toBe(hole);
  });

  it('renders point geometry without attempting simplification', async () => {
    const { updateRouteDisplayGeometry } = await import('./geometry');
    const { store } = await import('../state/store');
    const points: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
    ];
    const route = createRoute(points);
    route.geometryType = 'point';
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;

    updateRouteDisplayGeometry(route);

    expect(route._display?.simplified).toEqual(points);
    expect(route._display?.simplified).not.toBe(points);
    expect(route._display?.holes).toEqual([]);
  });

  it('uses raw non-edit geometry when the global original-geometry toggle is enabled', async () => {
    vi.doMock('../utils/geo', async () => {
      const actual =
        await vi.importActual<typeof import('../utils/geo')>('../utils/geo');
      return {
        ...actual,
        visvalingamWhyattIndices: vi.fn(() => [0, 3]),
      };
    });

    const { updateRouteDisplayGeometry } = await import('./geometry');
    const { store } = await import('../state/store');
    const points: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.05, lon: 120.05 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.15, lon: 120.15 },
    ];
    const route = createRoute(points);
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;
    store.uiState.showOriginalRouteGeometry = true;

    updateRouteDisplayGeometry(route);

    expect(route._display?.simplified).toEqual(points);
    expect(route._display?.simplified).not.toBe(points);
  });

  it('keeps edit mode rendering live original geometry even when the global toggle is enabled', async () => {
    const { updateRouteDisplayGeometry } = await import('./geometry');
    const { store } = await import('../state/store');
    const outer: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.2 },
      { lat: 30.2, lon: 120.2 },
      { lat: 30.2, lon: 120.0 },
    ];
    const hole: Point[] = [
      { lat: 30.05, lon: 120.05 },
      { lat: 30.05, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
    ];
    const route = createRoute(outer);
    route.geometryType = 'polygon';
    route.holes = [hole];
    route.editable = true;
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;
    store.uiState.showOriginalRouteGeometry = true;

    updateRouteDisplayGeometry(route);

    expect(route._display?.simplified).toBe(outer);
    expect(route._display?.holes?.[0]).toBe(hole);
  });

  it('refreshes only visible routes when the global original-geometry toggle changes', async () => {
    vi.doMock('../utils/geo', async () => {
      const actual =
        await vi.importActual<typeof import('../utils/geo')>('../utils/geo');
      return {
        ...actual,
        visvalingamWhyattIndices: vi.fn(() => [0, 3]),
      };
    });

    const { refreshAllRouteDisplayGeometry, updateRouteDisplayGeometry } =
      await import('./geometry');
    const { store } = await import('../state/store');
    const visiblePoints: Point[] = [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.05, lon: 120.05 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.15, lon: 120.15 },
    ];
    const hiddenPoints: Point[] = [
      { lat: 31.0, lon: 121.0 },
      { lat: 31.05, lon: 121.05 },
      { lat: 31.1, lon: 121.1 },
      { lat: 31.15, lon: 121.15 },
    ];
    const visibleRoute = createRoute(visiblePoints);
    const hiddenRoute = createRoute(hiddenPoints);
    hiddenRoute.id = 'route-2';
    hiddenRoute.visible = false;
    store.routes = [visibleRoute, hiddenRoute];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = {} as never;
    store.uiState.showOriginalRouteGeometry = false;

    updateRouteDisplayGeometry(visibleRoute);
    updateRouteDisplayGeometry(hiddenRoute);

    expect(visibleRoute._display?.simplified).toHaveLength(2);
    expect(hiddenRoute._display?.simplified).toHaveLength(2);

    store.uiState.showOriginalRouteGeometry = true;
    refreshAllRouteDisplayGeometry();

    expect(visibleRoute._display?.simplified).toEqual(visiblePoints);
    expect(visibleRoute._display?.simplified).not.toBe(visiblePoints);
    expect(hiddenRoute._display?.simplified).toHaveLength(2);
  });
});
