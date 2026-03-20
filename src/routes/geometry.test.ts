/**
 * Route geometry endpoint selection tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store, type Route, type Point } from '../state/store';

vi.mock('leaflet', () => {
  const markerInstance = {
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  };

  return {
    default: {
      marker: vi.fn(() => markerInstance),
      latLng: vi.fn((lat: number, lon: number) => ({ lat, lng: lon })),
      divIcon: vi.fn((opts: unknown) => opts),
    },
    marker: vi.fn(() => markerInstance),
    latLng: vi.fn((lat: number, lon: number) => ({ lat, lng: lon })),
    divIcon: vi.fn((opts: unknown) => opts),
  };
});

function createEditableRoute(id: string, points: Point[]): Route {
  return {
    id,
    name: `Route-${id}`,
    points: [...points],
    color: '#1E88E5',
    editable: true,
    visible: true,
    selected: true,
  };
}

describe('routes/geometry endpoint controls', () => {
  beforeEach(() => {
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = null;
  });

  it('should prepend node to absolute head and select index 0', async () => {
    const { prependNodeToRoute } = await import('./geometry');

    const route = createEditableRoute('r-1', [
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;

    prependNodeToRoute(route.id, 30.0, 120.0);

    expect(route.points.length).toBe(3);
    expect(route.points[0]).toEqual({ lat: 30.0, lon: 120.0 });
    expect(store.selectedPoint).toEqual({ routeId: route.id, pointIdx: 0 });
  });

  it('should clear stale edit handle when prepending at head', async () => {
    const { prependNodeToRoute } = await import('./geometry');

    const route = createEditableRoute('r-1-handle', [
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.setEditHandle(route.id, 1, {} as never);

    prependNodeToRoute(route.id, 30.0, 120.0);

    expect(store.editHandle).toBeNull();
  });

  it('should reject endpoint selection when map is not ready', async () => {
    const { selectRouteEndpoint } = await import('./geometry');

    const route = createEditableRoute('r-2-no-map', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.map = null;

    const selected = selectRouteEndpoint(route.id, 'start');

    expect(selected).toBe(false);
    expect(store.selectedPoint).toBeNull();
  });

  it('should select start endpoint for editable route', async () => {
    const { selectRouteEndpoint } = await import('./geometry');

    const route = createEditableRoute('r-2', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.map = {} as never;

    const selected = selectRouteEndpoint(route.id, 'start');

    expect(selected).toBe(true);
    expect(store.selectedPoint).toEqual({ routeId: route.id, pointIdx: 0 });
  });

  it('should select end endpoint for editable route', async () => {
    const { selectRouteEndpoint } = await import('./geometry');

    const route = createEditableRoute('r-3', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.map = {} as never;

    const selected = selectRouteEndpoint(route.id, 'end');

    expect(selected).toBe(true);
    expect(store.selectedPoint).toEqual({ routeId: route.id, pointIdx: 2 });
  });

  it('should reject endpoint selection for non-editable route', async () => {
    const { selectRouteEndpoint } = await import('./geometry');

    const route = createEditableRoute('r-4', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
    ]);
    route.editable = false;

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.map = {} as never;

    const selected = selectRouteEndpoint(route.id, 'start');

    expect(selected).toBe(false);
    expect(store.selectedPoint).toBeNull();
  });

  it('should delete node by index and invalidate distance cache', async () => {
    const { deleteNodeFromRoute } = await import('./geometry');

    const route = createEditableRoute('r-del-1', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);
    route._distCache = [0, 10, 20];

    store.routes = [route];

    const deleted = deleteNodeFromRoute(route.id, 1);

    expect(deleted).toBe(true);
    expect(route.points).toEqual([
      { lat: 30.0, lon: 120.0 },
      { lat: 30.2, lon: 120.2 },
    ]);
    expect(route._distCache).toBeUndefined();
  });

  it('should clear selected point when deleting the selected index', async () => {
    const { deleteNodeFromRoute } = await import('./geometry');

    const route = createEditableRoute('r-del-2', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ]);

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.selectedPoint = { routeId: route.id, pointIdx: 1 };

    const deleted = deleteNodeFromRoute(route.id, 1);

    expect(deleted).toBe(true);
    expect(store.selectedPoint).toBeNull();
  });

  it('should reject delete for invalid index', async () => {
    const { deleteNodeFromRoute } = await import('./geometry');

    const route = createEditableRoute('r-del-3', [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
    ]);

    store.routes = [route];

    const deleted = deleteNodeFromRoute(route.id, -1);

    expect(deleted).toBe(false);
    expect(route.points.length).toBe(2);
  });

  it('should remove a hole when deleting from a minimal polygon hole ring', async () => {
    const { deleteNodeFromRoute } = await import('./geometry');

    const route = createEditableRoute('poly-hole', [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
      { lat: 1, lon: 0 },
    ]);
    route.geometryType = 'polygon';
    route.holes = [[
      { lat: 0.2, lon: 0.2 },
      { lat: 0.2, lon: 0.4 },
      { lat: 0.4, lon: 0.3 },
    ]];

    store.routes = [route];
    store.selectedRouteId = route.id;
    store.selectedPoint = { routeId: route.id, pointIdx: 1, ringIndex: 1 };

    const deleted = deleteNodeFromRoute(route.id, 1, 1);

    expect(deleted).toBe(true);
    expect(route.holes).toEqual([]);
    expect(store.selectedPoint).toBeNull();
  });
});
