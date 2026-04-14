/**
 * Built-in Leaflet.VectorGrid style factory for vector basemap layers.
 * Converts catalog-provided vector layer names into deterministic styles.
 * Labels and POI-style layers are suppressed in v1.
 */

import type { NormalizedVectorLayer } from '../mbtiles/vector-metadata';
import type { VectorGridStyleOptions } from 'leaflet.vectorgrid';

export type VectorGridLayerStyle = VectorGridStyleOptions | [];

/**
 * Label-like layer name patterns suppressed in v1.
 */
const LABEL_PATTERNS = [
  '_labels',
  'pois',
  'addresses',
  'places',
  'roads_labels',
  'water_labels',
  'landuse_labels',
  'building_labels',
  'boundary_labels',
  'transit',
];

/**
 * Checks if a layer ID represents a label or POI layer that should be suppressed in v1.
 */
function isLabelLayer(layerId: string): boolean {
  const lower = layerId.toLowerCase();
  for (const pattern of LABEL_PATTERNS) {
    if (lower.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Neutral palette colors for basemap layers.
 * Designed to complement existing raster basemaps (OSM, CartoDB, etc.).
 */
const COLORS = {
  ocean: '#dfeaf3',
  waterLine: '#a9c0d2',
  waterPolygon: '#d7e6f1',
  land: '#f4f1ea',
  landuse: '#e9e4d9',
  buildings: '#d8d1c8',
  buildingStroke: '#c8c0b7',
  boundaries: '#a8a1ad',
  streets: '#b6aea6',
  bridges: '#aca39b',
  ferries: '#9eb7c8',
  aerialways: '#b8b2ab',
  publicTransport: '#b3afb8',
  roadsPolygon: '#d7d1c8',
  unknown: '#cfc8c0',
} as const;

/**
 * Known polygon layer IDs and their style overrides.
 */
const POLYGON_STYLES: Record<string, VectorGridStyleOptions> = {
  ocean: {
    fill: true,
    fillColor: COLORS.ocean,
    fillOpacity: 0.95,
    stroke: false,
  },
  water_polygons: {
    fill: true,
    fillColor: COLORS.waterPolygon,
    fillOpacity: 0.72,
    stroke: false,
  },
  buildings: {
    fill: true,
    fillColor: COLORS.buildings,
    fillOpacity: 0.32,
    stroke: true,
    color: COLORS.buildingStroke,
    weight: 0.35,
    opacity: 0.18,
  },
  land: {
    fill: true,
    fillColor: COLORS.land,
    fillOpacity: 1,
    stroke: false,
  },
  landuse: {
    fill: true,
    fillColor: COLORS.landuse,
    fillOpacity: 0.35,
    stroke: false,
  },
  street_polygons: {
    fill: true,
    fillColor: COLORS.roadsPolygon,
    fillOpacity: 0.16,
    stroke: false,
  },
} as const;

/**
 * Known line layer IDs and their style overrides.
 */
const LINE_STYLES: Record<string, VectorGridStyleOptions> = {
  water_lines: {
    stroke: true,
    color: COLORS.waterLine,
    weight: 0.7,
    opacity: 0.35,
  },
  boundaries: {
    stroke: true,
    color: COLORS.boundaries,
    weight: 0.8,
    opacity: 0.35,
    dashArray: '4 4',
  },
  roads: {
    stroke: true,
    color: COLORS.streets,
    weight: 1.15,
    opacity: 0.45,
  },
  streets: {
    stroke: true,
    color: COLORS.streets,
    weight: 1.15,
    opacity: 0.45,
  },
  bridges: {
    stroke: true,
    color: COLORS.bridges,
    weight: 1.25,
    opacity: 0.52,
  },
  ferries: {
    stroke: true,
    color: COLORS.ferries,
    weight: 0.95,
    opacity: 0.42,
    dashArray: '6 6',
  },
  aerialways: {
    stroke: true,
    color: COLORS.aerialways,
    weight: 0.8,
    opacity: 0.3,
    dashArray: '2 6',
  },
  public_transport: {
    stroke: true,
    color: COLORS.publicTransport,
    weight: 0.75,
    opacity: 0.22,
    dashArray: '4 6',
  },
} as const;

/**
 * Returns the style for a known polygon layer, or null if not a polygon.
 */
function getPolygonStyle(layerId: string): VectorGridStyleOptions | null {
  return POLYGON_STYLES[layerId] ?? null;
}

/**
 * Returns the style for a known line layer, or null if not a line.
 */
function getLineStyle(layerId: string): VectorGridStyleOptions | null {
  return LINE_STYLES[layerId] ?? null;
}

/**
 * Returns a generic fallback style for unknown non-label polygon layers.
 */
function fallbackPolygonStyle(): VectorGridStyleOptions {
  return {
    fill: true,
    fillColor: COLORS.unknown,
    fillOpacity: 0.1,
    stroke: false,
  };
}

/**
 * Returns a generic fallback style for unknown non-label line layers.
 */
function fallbackLineStyle(): VectorGridStyleOptions {
  return {
    stroke: true,
    color: COLORS.unknown,
    weight: 0.65,
    opacity: 0.18,
  };
}

/**
 * Heuristic guess of layer geometry type from layer ID.
 * Returns 'polygon', 'line', or null (for unknown/special layers).
 */
function guessLayerType(layerId: string): 'polygon' | 'line' | null {
  const lower = layerId.toLowerCase();

  // Polygon patterns
  if (
    lower.includes('polygon') ||
    lower.includes('building') ||
    lower.includes('land') ||
    lower.includes('landuse') ||
    lower.includes('water_polygon') ||
    lower.includes('street_polygon') ||
    lower.includes('ocean')
  ) {
    return 'polygon';
  }

  // Line patterns
  if (
    lower.includes('line') ||
    lower.includes('road') ||
    lower.includes('street') ||
    lower.includes('bridge') ||
    lower.includes('ferry') ||
    lower.includes('aerialway') ||
    lower.includes('transport') ||
    lower.includes('boundary') ||
    lower.includes('water_line')
  ) {
    return 'line';
  }

  return null;
}

/**
 * Generates a deterministic style entry for a single vector layer.
 * Suppresses label/POI-like layers in v1 (returns null).
 * For known layers, returns specific styles. For unknown layers,
 * applies a generic fallback based on guessed geometry type.
 */
export function getStyleForLayer(
  layer: NormalizedVectorLayer
): VectorGridLayerStyle {
  const layerId = layer.id.toLowerCase();

  if (isLabelLayer(layerId)) {
    return [];
  }

  // Try polygon styles first
  const polygonStyle = getPolygonStyle(layerId);
  if (polygonStyle !== null) {
    return polygonStyle;
  }

  // Try line styles
  const lineStyle = getLineStyle(layerId);
  if (lineStyle !== null) {
    return lineStyle;
  }

  // Heuristic fallback based on layer ID
  const guessedType = guessLayerType(layerId);
  if (guessedType === 'polygon') {
    return fallbackPolygonStyle();
  }
  if (guessedType === 'line') {
    return fallbackLineStyle();
  }

  // Default fallback: visible polygon-style
  return fallbackPolygonStyle();
}

/**
 * Converts a list of catalog-provided vector layers into a
 * deterministic Leaflet.VectorGrid styles object.
 * Label/POI layers are suppressed via explicit empty style entries.
 *
 * @param layers - Array of NormalizedVectorLayer from catalog metadata
 * @returns Record mapping layer ID to VectorGrid layer styles
 */
export function buildVectorLayerStyles(
  layers: NormalizedVectorLayer[]
): Record<string, VectorGridLayerStyle> {
  const styles: Record<string, VectorGridLayerStyle> = {};

  for (const layer of layers) {
    styles[layer.id] = getStyleForLayer(layer);
  }

  return styles;
}
