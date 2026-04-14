/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FilesPanel from './FilesPanel.vue';
import * as L from 'leaflet';
import {
  initializeBaseLayers,
  resetBaseLayerStateForTests,
} from '../../map/layers';
import { type Route, store } from '../../state/store';
import { resetViewBridgeStateForTests } from '../../ui/viewBridge';

vi.mock('leaflet.vectorgrid', () => ({
  VectorGridProtobuf: vi.fn(
    (url: string, options?: Record<string, unknown>) => {
      return L.tileLayer(url, options as L.TileLayerOptions);
    }
  ),
}));

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
    resetBaseLayerStateForTests();
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

  it('renders built-in basemap options', () => {
    const wrapper = mount(FilesPanel);

    const optionValues = wrapper
      .findAll('#map-select option')
      .map((option) => option.attributes('value'));

    expect(optionValues).toContain('osm');
    expect(optionValues).toContain('satellite');
    expect(optionValues).toContain('cartoDark');
    expect(optionValues).toContain('cartoLight');
  });

  it('renders vector MBTiles entries with a distinct label while preserving raster labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url === '/api/tianditu/health') {
          return new Response(JSON.stringify({ available: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url === '/api/mbtiles/catalog') {
          return new Response(
            JSON.stringify({
              sources: [
                {
                  id: 'raster-source',
                  label: 'Raster Tiles',
                  format: 'png',
                  minZoom: 0,
                  maxZoom: 14,
                  bounds: [73, 18, 135, 54],
                  attribution: 'Local Raster',
                  sourceType: 'raster',
                },
                {
                  id: 'vector-source',
                  label: 'Vector Tiles',
                  format: 'pbf',
                  minZoom: 0,
                  maxZoom: 14,
                  bounds: [73, 18, 135, 54],
                  attribution: 'Local Vector',
                  sourceType: 'vector',
                  vectorLayers: [
                    {
                      id: 'roads',
                      description: 'Roads',
                      minZoom: 0,
                      maxZoom: 14,
                    },
                  ],
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    await initializeBaseLayers();

    const wrapper = mount(FilesPanel);
    const optionLabels = wrapper
      .findAll('#map-select option')
      .map((option) => option.text());

    expect(optionLabels).toContain('本地 MBTiles · Raster Tiles');
    expect(optionLabels).toContain('本地矢量 MBTiles · Vector Tiles');
  });
});
