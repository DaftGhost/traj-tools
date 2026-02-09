/**
 * Heat layer type utilities
 * Provides type-safe access to leaflet.heat layer methods
 */

/**
 * Extended heat layer interface with option setter
 */
export interface HeatLayerEx extends L.Layer {
  setLatLngs(latlngs: [number, number][]): this;
  setOptions(opts: HeatLayerOptions): this;
}

export interface HeatLayerOptions {
  radius: number;
  blur: number;
  minOpacity: number;
  gradient: Record<number, string>;
}

/**
 * Type guard to check if a layer is a heat layer with setLatLngs
 */
export function isHeatLayerWithSetLatLngs(layer: L.Layer | null): layer is HeatLayerEx {
  if (!layer) return false;
  return typeof (layer as HeatLayerEx).setLatLngs === 'function';
}

/**
 * Type guard to check if a layer is a heat layer with setOptions
 */
export function isHeatLayerWithSetOptions(layer: L.Layer | null): layer is HeatLayerEx {
  if (!layer) return false;
  return typeof (layer as HeatLayerEx).setOptions === 'function';
}

/**
 * Safely call setLatLngs on a heat layer
 */
export function safeSetLatLngs(layer: L.Layer | null, latlngs: [number, number][]): void {
  if (layer && isHeatLayerWithSetLatLngs(layer)) {
    layer.setLatLngs(latlngs);
  }
}

/**
 * Safely call setOptions on a heat layer
 */
export function safeSetOptions(layer: L.Layer | null, options: HeatLayerOptions): void {
  if (layer && isHeatLayerWithSetOptions(layer)) {
    layer.setOptions(options);
  }
}
