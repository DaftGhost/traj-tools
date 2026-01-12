/**
 * Leaflet.heat 类型声明
 */

declare module 'leaflet.heat' {
  import * as L from 'leaflet';

  export default function heatLayer(
    points: [number, number][] | [number, number, number][],
    options?: HeatLayerOptions
  ): L.Layer;

  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    minOpacity?: number;
    gradient?: Record<number, string>;
    pane?: string;
  }
}
