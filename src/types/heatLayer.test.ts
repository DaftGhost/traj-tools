/**
 * Heat layer type utilities tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as L from 'leaflet';
import type { HeatLayerOptions } from './heatLayer';

describe('types/heatLayer', () => {
  describe('HeatLayerOptions', () => {
    it('should accept valid options', () => {
      const options: HeatLayerOptions = {
        radius: 25,
        blur: 15,
        minOpacity: 0.1,
        gradient: { 0.4: 'blue', 0.6: 'lime', 0.7: 'yellow', 0.8: 'orange', 1.0: 'red' }
      };

      expect(options.radius).toBe(25);
      expect(options.blur).toBe(15);
      expect(options.minOpacity).toBe(0.1);
      expect(options.gradient[0.4]).toBe('blue');
    });

    it('should handle empty gradient', () => {
      const options: HeatLayerOptions = {
        radius: 25,
        blur: 15,
        minOpacity: 0.1,
        gradient: {}
      };

      expect(Object.keys(options.gradient).length).toBe(0);
    });

    it('should handle custom gradient colors', () => {
      const options: HeatLayerOptions = {
        radius: 30,
        blur: 10,
        minOpacity: 0.5,
        gradient: { 0: 'white', 0.5: 'yellow', 1: 'red' }
      };

      expect(options.gradient[0]).toBe('white');
      expect(options.gradient[0.5]).toBe('yellow');
      expect(options.gradient[1]).toBe('red');
    });
  });

  describe('isHeatLayerWithSetLatLngs', () => {
    it('should return true for object with setLatLngs method', async () => {
      const { isHeatLayerWithSetLatLngs } = await import('./heatLayer');

      const mockLayer = {
        setLatLngs: (data: [number, number][]) => mockLayer,
        setOptions: () => mockLayer
      };

      expect(isHeatLayerWithSetLatLngs(mockLayer as unknown as L.Layer)).toBe(true);
    });

    it('should return false for object without setLatLngs', async () => {
      const { isHeatLayerWithSetLatLngs } = await import('./heatLayer');

      const mockLayer = {
        setOptions: () => mockLayer
      };

      expect(isHeatLayerWithSetLatLngs(mockLayer as unknown as L.Layer)).toBe(false);
    });

    it('should return false for null', async () => {
      const { isHeatLayerWithSetLatLngs } = await import('./heatLayer');

      expect(isHeatLayerWithSetLatLngs(null as unknown as L.Layer)).toBe(false);
    });

    it('should return false for undefined', async () => {
      const { isHeatLayerWithSetLatLngs } = await import('./heatLayer');

      expect(isHeatLayerWithSetLatLngs(undefined as unknown as L.Layer)).toBe(false);
    });
  });

  describe('isHeatLayerWithSetOptions', () => {
    it('should return true for object with setOptions method', async () => {
      const { isHeatLayerWithSetOptions } = await import('./heatLayer');

      const mockLayer = {
        setLatLngs: () => mockLayer,
        setOptions: (opts: unknown) => mockLayer
      };

      expect(isHeatLayerWithSetOptions(mockLayer as unknown as L.Layer)).toBe(true);
    });

    it('should return false for object without setOptions', async () => {
      const { isHeatLayerWithSetOptions } = await import('./heatLayer');

      const mockLayer = {
        setLatLngs: () => mockLayer
      };

      expect(isHeatLayerWithSetOptions(mockLayer as unknown as L.Layer)).toBe(false);
    });
  });

  describe('safeSetLatLngs', () => {
    it('should call setLatLngs when method exists', async () => {
      const { safeSetLatLngs } = await import('./heatLayer');

      let called = false;
      const mockLayer = {
        setLatLngs: (data: [number, number][]) => {
          called = true;
          expect(data.length).toBe(2);
          return mockLayer;
        }
      };

      const testData: [number, number][] = [[30, 120], [31, 121]];
      safeSetLatLngs(mockLayer as unknown as L.Layer, testData);

      expect(called).toBe(true);
    });

    it('should not throw when layer is null', async () => {
      const { safeSetLatLngs } = await import('./heatLayer');

      const testData: [number, number][] = [[30, 120]];

      expect(() => safeSetLatLngs(null, testData)).not.toThrow();
    });

    it('should not throw when layer does not have setLatLngs', async () => {
      const { safeSetLatLngs } = await import('./heatLayer');

      const mockLayer = {
        someOtherMethod: () => {}
      };

      const testData: [number, number][] = [[30, 120]];

      expect(() => safeSetLatLngs(mockLayer as unknown as L.Layer, testData)).not.toThrow();
    });
  });

  describe('safeSetOptions', () => {
    it('should call setOptions when method exists', async () => {
      const { safeSetOptions } = await import('./heatLayer');

      let calledWith: HeatLayerOptions | null = null;
      const mockLayer = {
        setLatLngs: () => mockLayer,
        setOptions: (opts: HeatLayerOptions) => {
          calledWith = opts;
          return mockLayer;
        }
      };

      const options: HeatLayerOptions = {
        radius: 25,
        blur: 15,
        minOpacity: 0.1,
        gradient: { 0.4: 'blue' }
      };

      safeSetOptions(mockLayer as unknown as L.Layer, options);

      expect(calledWith).not.toBeNull();
      expect(calledWith!.radius).toBe(25);
      expect(calledWith!.blur).toBe(15);
    });

    it('should not throw when layer is null', async () => {
      const { safeSetOptions } = await import('./heatLayer');

      const options: HeatLayerOptions = {
        radius: 25,
        blur: 15,
        minOpacity: 0.1,
        gradient: {}
      };

      expect(() => safeSetOptions(null, options)).not.toThrow();
    });

    it('should not throw when layer does not have setOptions', async () => {
      const { safeSetOptions } = await import('./heatLayer');

      const mockLayer = {
        setLatLngs: () => mockLayer
      };

      const options: HeatLayerOptions = {
        radius: 25,
        blur: 15,
        minOpacity: 0.1,
        gradient: {}
      };

      expect(() => safeSetOptions(mockLayer as unknown as L.Layer, options)).not.toThrow();
    });
  });
});
