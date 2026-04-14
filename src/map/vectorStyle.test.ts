/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import {
  buildVectorLayerStyles,
  getStyleForLayer,
  type VectorGridLayerStyle,
} from './vectorStyle';
import type { NormalizedVectorLayer } from '../mbtiles/vector-metadata';
import type { VectorGridStyleOptions } from 'leaflet.vectorgrid';

const makeLayer = (id: string): NormalizedVectorLayer => ({
  id,
  description: `test layer ${id}`,
  minZoom: 0,
  maxZoom: 14,
});

function asPathStyle(style: VectorGridLayerStyle): VectorGridStyleOptions {
  expect(Array.isArray(style)).toBe(false);
  return style as VectorGridStyleOptions;
}

describe('vectorStyle', () => {
  describe('getStyleForLayer', () => {
    it('returns correct style for water_polygons', () => {
      const style = getStyleForLayer(makeLayer('water_polygons'));
      expect(style).toEqual({
        fill: true,
        fillColor: '#d7e6f1',
        fillOpacity: 0.72,
        stroke: false,
      });
    });

    it('returns correct style for buildings', () => {
      const style = getStyleForLayer(makeLayer('buildings'));
      expect(style).toEqual({
        fill: true,
        fillColor: '#d8d1c8',
        fillOpacity: 0.32,
        stroke: true,
        color: '#c8c0b7',
        weight: 0.35,
        opacity: 0.18,
      });
    });

    it('returns correct style for land', () => {
      const style = getStyleForLayer(makeLayer('land'));
      expect(style).toEqual({
        fill: true,
        fillColor: '#f4f1ea',
        fillOpacity: 1,
        stroke: false,
      });
    });

    it('returns correct style for water_lines', () => {
      const style = getStyleForLayer(makeLayer('water_lines'));
      expect(style).toEqual({
        stroke: true,
        color: '#a9c0d2',
        weight: 0.7,
        opacity: 0.35,
      });
    });

    it('returns correct style for boundaries', () => {
      const style = getStyleForLayer(makeLayer('boundaries'));
      expect(style).toEqual({
        stroke: true,
        color: '#a8a1ad',
        weight: 0.8,
        opacity: 0.35,
        dashArray: '4 4',
      });
    });

    it('returns explicit muted style for streets', () => {
      const style = getStyleForLayer(makeLayer('streets'));
      expect(style).toEqual({
        stroke: true,
        color: '#b6aea6',
        weight: 1.15,
        opacity: 0.45,
      });
    });

    it('returns explicit muted style for bridges', () => {
      const style = getStyleForLayer(makeLayer('bridges'));
      expect(style).toEqual({
        stroke: true,
        color: '#aca39b',
        weight: 1.25,
        opacity: 0.52,
      });
    });

    it('returns explicit muted style for ferries', () => {
      const style = getStyleForLayer(makeLayer('ferries'));
      expect(style).toEqual({
        stroke: true,
        color: '#9eb7c8',
        weight: 0.95,
        opacity: 0.42,
        dashArray: '6 6',
      });
    });

    it('returns explicit muted style for aerialways', () => {
      const style = getStyleForLayer(makeLayer('aerialways'));
      expect(style).toEqual({
        stroke: true,
        color: '#b8b2ab',
        weight: 0.8,
        opacity: 0.3,
        dashArray: '2 6',
      });
    });

    it('returns explicit muted style for ocean', () => {
      const style = getStyleForLayer(makeLayer('ocean'));
      expect(style).toEqual({
        fill: true,
        fillColor: '#dfeaf3',
        fillOpacity: 0.95,
        stroke: false,
      });
    });

    it('returns explicit subdued style for public_transport', () => {
      const style = getStyleForLayer(makeLayer('public_transport'));
      expect(style).toEqual({
        stroke: true,
        color: '#b3afb8',
        weight: 0.75,
        opacity: 0.22,
        dashArray: '4 6',
      });
    });

    it('suppresses place_labels', () => {
      expect(getStyleForLayer(makeLayer('place_labels'))).toEqual([]);
    });

    it('suppresses pois', () => {
      expect(getStyleForLayer(makeLayer('pois'))).toEqual([]);
    });

    it('suppresses addresses', () => {
      expect(getStyleForLayer(makeLayer('addresses'))).toEqual([]);
    });

    it('suppresses layers with _labels suffix', () => {
      expect(getStyleForLayer(makeLayer('roads_labels'))).toEqual([]);
      expect(getStyleForLayer(makeLayer('water_labels'))).toEqual([]);
      expect(getStyleForLayer(makeLayer('building_labels'))).toEqual([]);
    });

    it('suppresses transit layer', () => {
      expect(getStyleForLayer(makeLayer('transit'))).toEqual([]);
    });

    it('returns visible fallback for unknown polygon-like layer', () => {
      const style = asPathStyle(getStyleForLayer(makeLayer('landcover')));
      expect(style.fill).toBe(true);
      expect(style.fillColor).toBe('#cfc8c0');
      expect(style.fillOpacity).toBe(0.1);
      expect(style.stroke).toBe(false);
    });

    it('returns visible fallback for unknown line-like layer', () => {
      const style = asPathStyle(getStyleForLayer(makeLayer('ferry_lines')));
      expect(style.stroke).toBe(true);
      expect(style.weight).toBe(0.65);
      expect(style.opacity).toBe(0.18);
    });

    it('returns visible fallback for completely unknown layer', () => {
      const style = asPathStyle(
        getStyleForLayer(makeLayer('some_obscure_layer'))
      );
      expect(style.fill).toBe(true);
    });

    it('is case-insensitive for label pattern matching', () => {
      expect(getStyleForLayer(makeLayer('PLACE_LABELS'))).toEqual([]);
      expect(getStyleForLayer(makeLayer('POIS'))).toEqual([]);
      expect(getStyleForLayer(makeLayer('Water_Polygons'))).toEqual({
        fill: true,
        fillColor: '#d7e6f1',
        fillOpacity: 0.72,
        stroke: false,
      });
    });

    it('returns deterministic style for same layer id', () => {
      const style1 = getStyleForLayer(makeLayer('water_polygons'));
      const style2 = getStyleForLayer(makeLayer('water_polygons'));
      expect(style1).toEqual(style2);
    });
  });

  describe('buildVectorLayerStyles', () => {
    it('builds styles for known polygon and line layers', () => {
      const layers: NormalizedVectorLayer[] = [
        makeLayer('water_polygons'),
        makeLayer('boundaries'),
        makeLayer('land'),
        makeLayer('streets'),
        makeLayer('ocean'),
      ];

      const styles = buildVectorLayerStyles(layers);

      expect(styles['water_polygons']).toBeDefined();
      expect(styles['boundaries']).toBeDefined();
      expect(styles['land']).toBeDefined();
      expect(styles['streets']).toBeDefined();
      expect(styles['ocean']).toBeDefined();
      expect(Object.keys(styles)).toHaveLength(5);
    });

    it('includes explicit hidden styles for label and POI layers', () => {
      const layers: NormalizedVectorLayer[] = [
        makeLayer('water_polygons'),
        makeLayer('place_labels'),
        makeLayer('pois'),
        makeLayer('boundaries'),
      ];

      const styles = buildVectorLayerStyles(layers);

      expect(Object.keys(styles)).toHaveLength(4);
      expect(styles['water_polygons']).toBeDefined();
      expect(styles['boundaries']).toBeDefined();
      expect(styles['place_labels']).toEqual([]);
      expect(styles['pois']).toEqual([]);
    });

    it('applies fallback styles to unknown non-label layers', () => {
      const layers: NormalizedVectorLayer[] = [
        makeLayer('unknown_custom_layer'),
      ];

      const styles = buildVectorLayerStyles(layers);

      expect(styles['unknown_custom_layer']).toBeDefined();
      const style = asPathStyle(styles['unknown_custom_layer']);
      expect(style.fill).toBe(true);
    });

    it('returns empty object for empty layer array', () => {
      const styles = buildVectorLayerStyles([]);
      expect(styles).toEqual({});
    });

    it('returns hidden style entries when all layers are labels', () => {
      const layers: NormalizedVectorLayer[] = [
        makeLayer('place_labels'),
        makeLayer('pois'),
        makeLayer('roads_labels'),
      ];

      const styles = buildVectorLayerStyles(layers);

      expect(styles).toEqual({
        place_labels: [],
        pois: [],
        roads_labels: [],
      });
    });

    it('handles mixed known, unknown, and label layers', () => {
      const layers: NormalizedVectorLayer[] = [
        makeLayer('water_polygons'),
        makeLayer('place_labels'),
        makeLayer('custom_landuse'),
        makeLayer('pois'),
        makeLayer('boundaries'),
      ];

      const styles = buildVectorLayerStyles(layers);

      expect(Object.keys(styles)).toHaveLength(5);
      expect(styles['water_polygons']).toBeDefined();
      expect(styles['boundaries']).toBeDefined();
      expect(styles['custom_landuse']).toBeDefined();
      expect(styles['place_labels']).toEqual([]);
      expect(styles['pois']).toEqual([]);
    });
  });
});
