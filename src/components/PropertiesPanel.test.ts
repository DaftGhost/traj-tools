/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import PropertiesPanel from './PropertiesPanel.vue';
import { type Route, store } from '../state/store';
import { resetViewBridgeStateForTests } from '../ui/viewBridge';

function createPolygonRoute(): Route {
  return {
    id: 'polygon-a',
    name: 'Polygon Alpha',
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
    color: '#1E88E5',
    editable: true,
    visible: true,
    selected: true,
  };
}

describe('PropertiesPanel', () => {
  beforeEach(() => {
    resetViewBridgeStateForTests();
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
  });

  it('renders selected route and point details', () => {
    const route = createPolygonRoute();
    store.routes = [route];
    store.selectedRouteId = route.id;
    store.selectedPoint = { routeId: route.id, pointIdx: 1, ringIndex: 1 };

    const wrapper = mount(PropertiesPanel);

    expect(wrapper.get('#prop-route-name').text()).toBe('Polygon Alpha');
    expect(wrapper.get('#prop-route-type').text()).toBe('多边形');
    expect(
      (
        wrapper.get('#prop-route-geometry-type')
          .element as unknown as HTMLSelectElement
      ).value
    ).toBe('polygon');
    expect(wrapper.get('#prop-route-holes').text()).toBe('1');
    expect(wrapper.get('#prop-route-status').text()).toBe('可编辑');
    expect(wrapper.get('#prop-point-index').text()).toBe('环 2 / 点 2');
    expect(wrapper.get('#prop-point-lat').text()).toBe('30.020000');
    expect(wrapper.get('#prop-point-lon').text()).toBe('120.040000');
  });

  it('shows the empty hint when nothing is selected', () => {
    const wrapper = mount(PropertiesPanel);

    expect(wrapper.get('#prop-route-name').text()).toBe('-');
    expect(wrapper.get('#prop-route-geometry-type').text()).toBe('-');
    expect(wrapper.get('#prop-selection-info').text()).toContain(
      '请在地图上选择航线或点以查看属性'
    );
  });

  it('changes route geometry type and clears incompatible polygon state', async () => {
    const route = createPolygonRoute();
    store.routes = [route];
    store.selectedRouteId = route.id;
    store.selectedPoint = { routeId: route.id, pointIdx: 1, ringIndex: 1 };

    const wrapper = mount(PropertiesPanel);
    await wrapper.get('#prop-route-geometry-type').setValue('polyline');

    expect(route.geometryType).toBe('polyline');
    expect(route.holes).toEqual([]);
    expect(store.selectedPoint).toBeNull();
  });
});
