/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import StatusBar from './StatusBar.vue';
import { type Route, store } from '../state/store';
import {
  clearStatusMessage,
  refreshStatusSummary,
  resetViewBridgeStateForTests,
} from '../ui/viewBridge';
import { setStatus, updateStatusCoords } from '../utils/uiStatus';

function createRoute(id: string): Route {
  return {
    id,
    name: `Route-${id}`,
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

describe('StatusBar', () => {
  beforeEach(() => {
    resetViewBridgeStateForTests();
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
  });

  it('renders route and point counts from store state', () => {
    store.routes = [createRoute('a'), createRoute('b')];

    const wrapper = mount(StatusBar);

    expect(wrapper.get('#status-route-count').text()).toBe('2 航线');
    expect(wrapper.get('#status-point-count').text()).toBe('6 点');
    expect(wrapper.get('#status-selection').text()).toBe('未选中');
  });

  it('renders status messages and coordinates from the bridge', async () => {
    store.routes = [createRoute('a')];
    store.selectedRouteId = 'a';

    const wrapper = mount(StatusBar);

    setStatus('正在编辑航线');
    updateStatusCoords(30.12345, 120.6789);
    await nextTick();

    expect(wrapper.get('#status-selection').text()).toBe('正在编辑航线');
    expect(wrapper.get('#status-coords').text()).toBe('30.1234, 120.6789');

    clearStatusMessage();
    refreshStatusSummary();
    await nextTick();

    expect(wrapper.get('#status-selection').text()).toBe('已选中');
  });
});
