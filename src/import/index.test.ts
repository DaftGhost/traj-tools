/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from 'vitest';

describe('import geometry modes', () => {
  beforeEach(async () => {
    const { store } = await import('../state/store');
    store.routes = [];
    store.selectedRouteId = null;
    store.selectedPoint = null;
    store.clearEditHandle();
    store.map = null;
  });

  it('parses CSV as point geometry when requested', async () => {
    const { parseFile } = await import('./index');
    const file = new File(['lat,lon\n30.0,120.0\n30.1,120.1'], 'points.csv', {
      type: 'text/csv',
    });

    const parsed = await parseFile(file, { csvGeometryType: 'point' });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      geometryType: 'point',
      points: [
        { lat: 30.0, lon: 120.0 },
        { lat: 30.1, lon: 120.1 },
      ],
    });
  });

  it('parses CSV as polygon geometry and strips repeated closing point', async () => {
    const { parseFile } = await import('./index');
    const file = new File(
      ['lat,lon\n30.0,120.0\n30.0,120.1\n30.1,120.1\n30.0,120.0'],
      'polygon.csv',
      { type: 'text/csv' }
    );

    const parsed = await parseFile(file, { csvGeometryType: 'polygon' });

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.geometryType).toBe('polygon');
    expect(parsed[0]?.points).toEqual([
      { lat: 30.0, lon: 120.0 },
      { lat: 30.0, lon: 120.1 },
      { lat: 30.1, lon: 120.1 },
    ]);
  });

  it('preserves GeoJSON Point as point geometry', async () => {
    const { parseGeoJSONFile } = await import('./index');
    const fileText = JSON.stringify({
      type: 'Point',
      coordinates: [120.0, 30.0],
    });
    const file = new File([fileText], 'single.geojson', {
      type: 'application/geo+json',
    });
    Object.assign(file, {
      text: async () => fileText,
    });

    const parsed = await parseGeoJSONFile(file);

    expect(parsed).toEqual([
      {
        geometryType: 'point',
        points: [{ lat: 30.0, lon: 120.0 }],
        name: undefined,
      },
    ]);
  });
});
