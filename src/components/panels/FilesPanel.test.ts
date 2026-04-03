/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FilesPanel from './FilesPanel.vue';
import { type Route, store } from '../../state/store';
import { resetViewBridgeStateForTests } from '../../ui/viewBridge';

function createRoute(id: string, name = `Route-${id}`): Route {
  return {
    id,
    name,
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.2, lon: 120.2 },
    ],
    color: '#1E88E5',
    editable: false,
    visible: true,
    selected: false,
  };
}

function createPolygonRoute(id: string, name = `Polygon-${id}`): Route {
  return {
    id,
    name,
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.1, lon: 120.0 },
    ],
    holes: [
      [
        { lat: 30.02, lon: 120.02 },
        { lat: 30.02, lon: 120.04 },
        { lat: 30.04, lon: 120.04 },
      ],
    ],
    geometryType: 'polygon',
    color: '#43A047',
    editable: false,
    visible: true,
    selected: false,
  };
}

describe('FilesPanel', () => {
  beforeEach(() => {
    resetViewBridgeStateForTests();
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders route entries and filters by search query', async () => {
    store.routes = [
      createRoute('line-a', 'Alpha Route'),
      createPolygonRoute('polygon-a', 'Beta Polygon'),
    ];

    const wrapper = mount(FilesPanel);

    expect(wrapper.findAll('.route-item')).toHaveLength(2);
    expect(wrapper.find('.route-count').text()).toBe('(2)');

    await wrapper.get('#route-search').setValue('polygon');

    const routeItems = wrapper.findAll('.route-item');
    expect(routeItems).toHaveLength(1);
    expect(routeItems[0]?.text()).toContain('Beta Polygon');
  });

  it('selects a route when clicking an entry', async () => {
    const routeA = createRoute('line-a', 'Alpha Route');
    const routeB = createRoute('line-b', 'Beta Route');
    store.routes = [routeA, routeB];

    const wrapper = mount(FilesPanel);

    await wrapper.findAll('.route-item')[1]!.trigger('click');

    expect(store.selectedRouteId).toBe(routeB.id);
    expect(wrapper.findAll('.route-item')[1]!.classes()).toContain('selected');
  });

  it('toggles route visibility from the checkbox', async () => {
    const route = createRoute('line-a');
    store.routes = [route];

    const wrapper = mount(FilesPanel);
    await wrapper.get('.route-checkbox').setValue(false);

    expect(route.visible).toBe(false);
  });
});
