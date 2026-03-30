/**
 * 导出模块测试
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store, type Route } from '../state/store';
import { swapLeftRight } from '../utils/helpers';
import * as snapUtils from '../utils/snap';
import { exportData, exportSegment } from './index';
import { extractRouteSegment } from '../tools/segment';
import type { SnapRef } from '../types/refs';

function createPolylineRoute(name: string): Route {
  return {
    id: name,
    name,
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.1, lon: 120.0 },
    ],
    geometryType: 'polyline',
    color: '#1E88E5',
    editable: false,
    visible: true,
    selected: false,
  };
}

function createPolygonRoute(name: string): Route {
  return {
    id: name,
    name,
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.1, lon: 120.0 },
    ],
    geometryType: 'polygon',
    holes: [],
    color: '#1E88E5',
    editable: false,
    visible: true,
    selected: false,
  };
}

function mountExportDom({
  format = 'csv',
  bidirectional = true,
  segmentAsLinestring = false,
}: {
  format?: 'csv' | 'geojson';
  bidirectional?: boolean;
  segmentAsLinestring?: boolean;
} = {}): void {
  document.body.innerHTML = `
    <select id="export-format">
      <option value="csv">CSV格式</option>
      <option value="geojson">GeoJSON格式</option>
    </select>
    <input id="export-bidirectional" type="checkbox" />
    <input id="segment-as-linestring" type="checkbox" />
  `;

  (document.getElementById('export-format') as unknown as HTMLSelectElement).value = format;
  (document.getElementById('export-bidirectional') as unknown as HTMLInputElement).checked = bidirectional;
  (document.getElementById('segment-as-linestring') as unknown as HTMLInputElement).checked = segmentAsLinestring;
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('exportData bidirectional option', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.segmentExport.startPoint = null;
    store.segmentExport.endPoint = null;
    store.clearEditHandle();
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('alert', vi.fn());
  });

  it('exports forward and reverse files for visible linestrings when bidirectional export is enabled', () => {
    mountExportDom({ format: 'csv', bidirectional: true });
    store.routes = [createPolylineRoute('route')];

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportData();

    expect(downloads).toEqual(['S_N_route.csv', 'N_S_route.csv']);
  });

  it('exports a single file for visible linestrings when bidirectional export is disabled', () => {
    mountExportDom({ format: 'csv', bidirectional: false });
    store.routes = [createPolylineRoute('route')];

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportData();

    expect(downloads).toEqual(['route.csv']);
  });

  it('exports polygons as a single file regardless of the bidirectional option', () => {
    mountExportDom({ format: 'geojson', bidirectional: true });
    store.routes = [createPolygonRoute('area')];

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportData();

    expect(downloads).toEqual(['area.geojson']);
  });

  it('exports polygons as GeoJSON even when CSV format is selected', () => {
    mountExportDom({ format: 'csv', bidirectional: true });
    store.routes = [createPolygonRoute('area')];

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportData();

    expect(downloads).toEqual(['area.geojson']);
  });
});

// Test the swapLeftRight function is working correctly in export context
describe('Export with left/right swapping', () => {
  it('should swap left/right in route names for reversed routes', () => {
    // Test baseName swapping
    expect(swapLeftRight('highway_left')).toBe('highway_right');
    expect(swapLeftRight('highway_right')).toBe('highway_left');
    expect(swapLeftRight('道路_左')).toBe('道路_右');
    expect(swapLeftRight('道路_右')).toBe('道路_左');
  });

  it('should swap left/right in prefix for reversed routes', () => {
    // Test prefix swapping (like segment ranges)
    expect(swapLeftRight('1-100_left')).toBe('1-100_right');
    expect(swapLeftRight('left_lane_50-150')).toBe('right_lane_50-150');
  });

  it('should handle complex route names', () => {
    // Test realistic route names
    expect(swapLeftRight('N_S_highway_left_lane')).toBe('N_S_highway_right_lane');
    expect(swapLeftRight('东西向_左侧_车道')).toBe('东西向_右侧_车道');
    expect(swapLeftRight('Left_Turn_Route')).toBe('Right_Turn_Route');
  });

  it('should not modify routes without left/right', () => {
    expect(swapLeftRight('N_S_highway')).toBe('N_S_highway');
    expect(swapLeftRight('center_lane')).toBe('center_lane');
    expect(swapLeftRight('1-100')).toBe('1-100');
  });

  it('should handle empty strings and prefixes', () => {
    expect(swapLeftRight('')).toBe('');
    expect(swapLeftRight('1-100')).toBe('1-100');
  });
});

describe('polygon segment extraction (cut-down export)', () => {
  const polygonRoute: Route = {
    id: 'poly',
    name: 'poly',
    points: [
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
      { lat: 30.1, lon: 120.0 },
    ],
    geometryType: 'polygon',
    holes: [],
    color: '#000',
    editable: false,
    visible: true,
    selected: false,
  };

  function makeRef(segIdx: number, segFrac: number, ringIndex = 0): SnapRef {
    return { routeId: 'poly', segIdx, segFrac, ringIndex };
  }

  function sp(lat: number, lon: number, ref: SnapRef) {
    return { lat, lon, ref };
  }

  it('extracts the forward arc between adjacent points on a polygon ring', () => {
    const start = sp(30.0, 120.0, makeRef(0, 0));
    const end = sp(30.0, 120.1, makeRef(1, 0));

    const result = extractRouteSegment(polygonRoute, start, end);

    expect(result).not.toBeNull();
    expect(result).toEqual([
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
    ]);
  });

  it('follows polygon point order from start to end', () => {
    const start = sp(30.0, 120.0, makeRef(0, 0));
    const end = sp(30.1, 120.1, makeRef(2, 0));

    const result = extractRouteSegment(polygonRoute, start, end);

    expect(result).toEqual([
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
    ]);
  });

  it('uses reversed click order to extract the complementary polygon arc', () => {
    const start = sp(30.1, 120.1, makeRef(2, 0));
    const end = sp(30.0, 120.0, makeRef(0, 0));

    const result = extractRouteSegment(polygonRoute, start, end);

    expect(result).toEqual([
      { lat: 30.1, lon: 120.1 },
      { lat: 30.1, lon: 120.0 },
      { lat: 30.0, lon: 120.0 },
    ]);
  });

  it('returns null when refs point to different routes', () => {
    const start = sp(30.0, 120.0, { routeId: 'other', segIdx: 0, segFrac: 0 });
    const end = sp(30.0, 120.1, makeRef(1, 0));

    const result = extractRouteSegment(polygonRoute, start, end);
    expect(result).toBeNull();
  });

  it('exports polygon segments as Polygon GeoJSON', async () => {
    mountExportDom({ format: 'csv', bidirectional: true });
    store.routes = [polygonRoute];
    store.selectedRouteId = polygonRoute.id;
    store.segmentExport.startPoint = { lat: 30.0, lon: 120.0 };
    store.segmentExport.endPoint = { lat: 30.0, lon: 120.1 };

    vi.spyOn(snapUtils, 'snapToRoutes')
      .mockReturnValueOnce({ lat: 30.0, lon: 120.0, ref: makeRef(0, 0) })
      .mockReturnValueOnce({ lat: 30.0, lon: 120.1, ref: makeRef(1, 0) });

    let downloadedBlob: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return 'blob:test';
      }),
    });

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportSegment();

    expect(downloads).toEqual(['poly_1-2.geojson']);
    expect(downloadedBlob).not.toBeNull();

    const json = JSON.parse(await readBlobAsText(downloadedBlob!)) as {
      features: Array<{
        geometry: {
          type: string;
          coordinates: [number, number][][];
        };
        properties: Record<string, unknown>;
      }>;
    };
    const ring = json.features[0].geometry.coordinates[0];

    expect(json.features[0].geometry.type).toBe('Polygon');
    expect(ring.length).toBe(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(json.features[0].properties.segment).toBe(true);
    expect(json.features[0].properties.sourceRoute).toBe('poly');
  });

  it('exports polygon segments as LineString GeoJSON when requested', async () => {
    mountExportDom({ format: 'csv', bidirectional: true, segmentAsLinestring: true });
    store.routes = [polygonRoute];
    store.selectedRouteId = polygonRoute.id;
    store.segmentExport.startPoint = { lat: 30.0, lon: 120.0 };
    store.segmentExport.endPoint = { lat: 30.0, lon: 120.1 };

    vi.spyOn(snapUtils, 'snapToRoutes')
      .mockReturnValueOnce({ lat: 30.0, lon: 120.0, ref: makeRef(0, 0) })
      .mockReturnValueOnce({ lat: 30.0, lon: 120.1, ref: makeRef(1, 0) });

    let downloadedBlob: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return 'blob:test';
      }),
    });

    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    exportSegment();

    expect(downloads).toEqual(['poly_1-2.geojson']);
    expect(downloadedBlob).not.toBeNull();

    const json = JSON.parse(await readBlobAsText(downloadedBlob!)) as {
      features: Array<{
        geometry: {
          type: string;
          coordinates: [number, number][];
        };
        properties: Record<string, unknown>;
      }>;
    };

    expect(json.features[0].geometry.type).toBe('LineString');
    expect(json.features[0].geometry.coordinates).toEqual([
      [120.0, 30.0],
      [120.1, 30.0],
    ]);
    expect(json.features[0].properties.segment).toBe(true);
    expect(json.features[0].properties.sourceRoute).toBe('poly');
  });
});

// Integration test concept (would need DOM mocking for full test)
describe('Export filename generation', () => {
  it('should generate correct forward and reverse filenames', () => {
    const baseName = 'highway_left';
    const prefix = '1-100';
    const direction = 'S';
    const reverseDirection = 'N';

    // Forward file
    const forwardName = `${reverseDirection}_${direction}_${baseName}_${prefix}`;
    expect(forwardName).toBe('N_S_highway_left_1-100');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`;
    expect(reverseName).toBe('S_N_highway_right_1-100');
  });

  it('should generate correct filenames for Chinese routes', () => {
    const baseName = '公路_左侧';
    const prefix = '路段_1';
    const direction = 'E';
    const reverseDirection = 'W';

    // Forward file
    const forwardName = `${reverseDirection}_${direction}_${baseName}_${prefix}`;
    expect(forwardName).toBe('W_E_公路_左侧_路段_1');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`;
    expect(reverseName).toBe('E_W_公路_右侧_路段_1');
  });

  it('should handle routes without prefix', () => {
    const baseName = 'highway_right';
    const prefix = '';
    const direction = 'N';
    const reverseDirection = 'S';

    // Forward file
    const forwardName = prefix ? `${reverseDirection}_${direction}_${baseName}_${prefix}` : `${reverseDirection}_${direction}_${baseName}`;
    expect(forwardName).toBe('S_N_highway_right');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = reversePrefix ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}` : `${direction}_${reverseDirection}_${reverseBaseName}`;
    expect(reverseName).toBe('N_S_highway_left');
  });
});
