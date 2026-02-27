/**
 * UI delete action tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { store, type Route } from '../state/store';

vi.mock('../config/constants', () => ({
  PALETTE: ['#1E88E5'],
}));

function createRoute(id: string, editable = true): Route {
  return {
    id,
    name: `Route-${id}`,
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ],
    color: '#1E88E5',
    editable,
    visible: true,
    selected: true,
  };
}

function appendElement(tag: string, id: string, className?: string): void {
  const el = document.createElement(tag);
  el.id = id;
  if (className) el.className = className;
  document.body.appendChild(el);
}

function mountDomForUiRefresh(): void {
  appendElement('div', 'routes-list');
  appendElement('input', 'route-search');
  appendElement('span', 'route-count', 'route-count');

  appendElement('span', 'prop-route-name');
  appendElement('span', 'prop-route-points');
  appendElement('span', 'prop-route-length');
  appendElement('span', 'prop-route-status');
  appendElement('span', 'prop-point-index');
  appendElement('span', 'prop-point-lat');
  appendElement('span', 'prop-point-lon');

  appendElement('div', 'endpoint-quick-controls');
  appendElement('button', 'select-start-endpoint');
  appendElement('button', 'select-end-endpoint');
}

describe('ui/index deleteSelectedNode', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.textContent = '';
    mountDomForUiRefresh();

    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = null;
  });

  it('should not delete when selection changes before async callback runs', async () => {
    const routeA = createRoute('route-a');
    const routeB = createRoute('route-b');
    store.routes = [routeA, routeB];
    store.selectedRouteId = routeA.id;
    store.selectedPoint = { routeId: routeA.id, pointIdx: 1 };

    vi.doMock('../routes/geometry', () => ({
      clearDragMarker: vi.fn(),
      updateRouteDisplayGeometry: vi.fn(),
      deleteNodeFromRoute: vi.fn((routeId: string, idx: number) => {
        const route = store.getRouteById(routeId);
        if (!route) return false;
        route.points.splice(idx, 1);
        return true;
      }),
    }));

    const ui = await import('./index');

    ui.deleteSelectedNode();

    store.selectedRouteId = routeB.id;
    store.selectedPoint = { routeId: routeB.id, pointIdx: 0 };

    await Promise.resolve();
    await Promise.resolve();

    expect(routeA.points.length).toBe(3);
    expect(routeB.points.length).toBe(3);
  });
});
