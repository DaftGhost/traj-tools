/**
 * 导出模块 - 处理数据导出功能
 */

import * as L from 'leaflet';
import Papa from 'papaparse';
import {
  getRouteGeoJSONGeometryType,
  getRouteGeometryType,
  isPointRoute,
  isPolygonRoute,
  Point,
  Route,
  store,
  supportsBidirectionalExport,
} from '../state/store';
import {
  calculateBearing,
  bearingToDirection,
  calculatePolygonArea,
  closeRing,
} from '../utils/geo';
import { swapLeftRight } from '../utils/helpers';
import { snapToRoutes } from '../utils/snap';
import { extractRouteSegment } from '../tools/segment';

// GeoJSON 类型定义
interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry:
    | GeoJSONPoint
    | GeoJSONMultiPoint
    | GeoJSONLineString
    | GeoJSONPolygon;
  properties?: Record<string, unknown>;
}

interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

interface GeoJSONMultiPoint {
  type: 'MultiPoint';
  coordinates: [number, number][];
}

interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

/**
 * 生成CSV数据
 */
function createCsvData(points: Point[]): Record<string, string>[] {
  return points.map((p, i) => ({
    纬度: Number(p.lat).toFixed(6),
    经度: Number(p.lon).toFixed(6),
    序号: String(i + 1),
  }));
}

/**
 * 导出CSV文件
 */
function downloadCsv(data: Record<string, string>[], filename: string): void {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 生成LineString GeoJSON数据
 */
function createLineGeoJSONData(
  points: Point[],
  properties: Record<string, unknown> = {}
): GeoJSONFeatureCollection {
  const coordinates: [number, number][] = points.map((p) => [p.lon, p.lat]);

  const lineString: GeoJSONLineString = {
    type: 'LineString',
    coordinates,
  };

  const feature: GeoJSONFeature = {
    type: 'Feature',
    geometry: lineString,
    properties: {
      pointCount: points.length,
      ...properties,
    },
  };

  return {
    type: 'FeatureCollection',
    features: [feature],
  };
}

function createPointGeoJSONData(
  points: Point[],
  properties: Record<string, unknown> = {}
): GeoJSONFeatureCollection {
  const geometry =
    points.length <= 1
      ? ({
          type: 'Point',
          coordinates: points[0]
            ? ([points[0].lon, points[0].lat] as [number, number])
            : ([0, 0] as [number, number]),
        } as GeoJSONPoint)
      : ({
          type: 'MultiPoint',
          coordinates: points.map(
            (point) => [point.lon, point.lat] as [number, number]
          ),
        } as GeoJSONMultiPoint);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry,
        properties: {
          pointCount: points.length,
          ...properties,
        },
      },
    ],
  };
}

function createPolygonSegmentGeoJSONData(
  points: Point[],
  properties: Record<string, unknown> = {}
): GeoJSONFeatureCollection {
  const ring = closeRing(points);

  // A cut-down polygon can be just one edge; duplicate the end vertex so the ring
  // still has the minimum 4 positions required by GeoJSON.
  if (ring.length === 3) {
    ring.splice(2, 0, { ...ring[1] });
  }

  const polygon: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [
      ring.map((point) => [point.lon, point.lat] as [number, number]),
    ],
  };

  const feature: GeoJSONFeature = {
    type: 'Feature',
    geometry: polygon,
    properties: {
      pointCount: points.length,
      geometryType: 'polygon',
      ...properties,
    },
  };

  return {
    type: 'FeatureCollection',
    features: [feature],
  };
}

/**
 * 生成GeoJSON数据
 */
function createGeoJSONData(
  route: Pick<Route, 'points' | 'holes' | 'geometryType'>
): GeoJSONFeatureCollection {
  if (getRouteGeometryType(route) === 'polygon') {
    const coordinates: [number, number][][] = [
      closeRing(route.points).map(
        (point) => [point.lon, point.lat] as [number, number]
      ),
      ...(route.holes ?? []).map((ring) =>
        closeRing(ring).map(
          (point) => [point.lon, point.lat] as [number, number]
        )
      ),
    ];

    const polygon: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates,
    };

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: polygon,
          properties: {
            pointCount: route.points.length,
            holeCount: route.holes?.length ?? 0,
            areaSqm: calculatePolygonArea(route.points, route.holes ?? []),
            geometryType: 'polygon',
          },
        },
      ],
    };
  }

  if (isPointRoute(route)) {
    return createPointGeoJSONData(route.points, {
      geometryType: getRouteGeoJSONGeometryType(route),
    });
  }

  return createLineGeoJSONData(route.points, {
    geometryType: 'polyline',
  });
}

/**
 * 下载GeoJSON文件
 */
function downloadGeoJSON(
  data: GeoJSONFeatureCollection,
  filename: string
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildExportSuffix(prefix: string = ''): string {
  return prefix ? '_' + prefix : '';
}

function exportSingleCsv(
  points: Point[],
  baseName: string,
  prefix: string = ''
): void {
  const csvData = createCsvData(points);
  downloadCsv(csvData, `${baseName}${buildExportSuffix(prefix)}.csv`);
}

function exportSingleGeoJSON(
  points: Point[],
  baseName: string,
  prefix: string = '',
  properties: Record<string, unknown> = {}
): void {
  const geojsonData = createLineGeoJSONData(points, properties);
  downloadGeoJSON(
    geojsonData,
    `${baseName}${buildExportSuffix(prefix)}.geojson`
  );
}

function exportPointGeoJSON(points: Point[], baseName: string): void {
  downloadGeoJSON(
    createPointGeoJSONData(points, {
      geometryType: points.length <= 1 ? 'Point' : 'MultiPoint',
    }),
    `${baseName}.geojson`
  );
}

/**
 * 导出正序和逆序CSV文件
 */
function exportForwardReverseCsv(
  points: Point[],
  baseName: string,
  prefix: string = ''
): void {
  if (points.length < 2) {
    exportSingleCsv(points, baseName, prefix);
    return;
  }

  // Calculate bearing directions
  // direction: bearing from start→end (represents the direction of travel)
  // reverseDirection: bearing from end→start (represents the opposite direction)
  const bearing = calculateBearing(points[0], points[points.length - 1]);
  const direction = bearingToDirection(bearing);
  const reverseBearing = calculateBearing(points[points.length - 1], points[0]);
  const reverseDirection = bearingToDirection(reverseBearing);

  // Forward file: filename shows where route starts (reverseDirection) and ends (direction)
  // Example: N_S means starts at North, ends at South
  const forwardCsv = createCsvData(points);
  const forwardName = prefix
    ? `${reverseDirection}_${direction}_${baseName}_${prefix}`
    : `${reverseDirection}_${direction}_${baseName}`;
  downloadCsv(forwardCsv, forwardName + '.csv');

  // Reverse file: filename shows where reversed route starts and ends
  // Example: S_N means starts at South (original end), ends at North (original start)
  // Also swap left/right in baseName and prefix for reversed routes
  const reversePoints = [...points].reverse();
  const reverseCsv = createCsvData(reversePoints);
  const reverseBaseName = swapLeftRight(baseName);
  const reversePrefix = swapLeftRight(prefix);
  const reverseName = reversePrefix
    ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`
    : `${direction}_${reverseDirection}_${reverseBaseName}`;
  downloadCsv(reverseCsv, reverseName + '.csv');
}

/**
 * 导出正序和逆序GeoJSON文件
 */
function exportForwardReverseGeoJSON(
  points: Point[],
  baseName: string,
  prefix: string = ''
): void {
  if (points.length < 2) {
    exportSingleGeoJSON(points, baseName, prefix);
    return;
  }

  // Calculate bearing directions
  // direction: bearing from start→end (represents the direction of travel)
  // reverseDirection: bearing from end→start (represents the opposite direction)
  const bearing = calculateBearing(points[0], points[points.length - 1]);
  const direction = bearingToDirection(bearing);
  const reverseBearing = calculateBearing(points[points.length - 1], points[0]);
  const reverseDirection = bearingToDirection(reverseBearing);

  // Forward file: filename shows where route starts (reverseDirection) and ends (direction)
  // Example: N_S means starts at North, ends at South
  const forwardGeoJSON = createLineGeoJSONData(points);
  const forwardName = prefix
    ? `${reverseDirection}_${direction}_${baseName}_${prefix}`
    : `${reverseDirection}_${direction}_${baseName}`;
  downloadGeoJSON(forwardGeoJSON, forwardName + '.geojson');

  // Reverse file: filename shows where reversed route starts and ends
  // Example: S_N means starts at South (original end), ends at North (original start)
  // Also swap left/right in baseName and prefix for reversed routes
  const reversePoints = [...points].reverse();
  const reverseGeoJSON = createLineGeoJSONData(reversePoints);
  const reverseBaseName = swapLeftRight(baseName);
  const reversePrefix = swapLeftRight(prefix);
  const reverseName = reversePrefix
    ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`
    : `${direction}_${reverseDirection}_${reverseBaseName}`;
  downloadGeoJSON(reverseGeoJSON, reverseName + '.geojson');
}

function exportRouteCsv(route: Route): void {
  if (!supportsBidirectionalExport(route) || !isBidirectionalExport()) {
    exportSingleCsv(route.points, route.name);
    return;
  }

  exportForwardReverseCsv(route.points, route.name);
}

function exportRouteGeoJSON(route: Route): void {
  if (isPointRoute(route)) {
    exportPointGeoJSON(route.points, route.name);
    return;
  }

  if (
    isPolygonRoute(route) ||
    !supportsBidirectionalExport(route) ||
    !isBidirectionalExport()
  ) {
    downloadGeoJSON(createGeoJSONData(route), route.name + '.geojson');
    return;
  }

  exportForwardReverseGeoJSON(route.points, route.name);
}

/**
 * 获取导出格式
 */
function getExportFormat(): 'csv' | 'geojson' {
  const select = document.getElementById(
    'export-format'
  ) as unknown as HTMLSelectElement;
  return (select?.value as 'csv' | 'geojson') || 'csv';
}

function isBidirectionalExport(): boolean {
  const checkbox = document.getElementById(
    'export-bidirectional'
  ) as HTMLInputElement | null;
  return checkbox?.checked ?? true;
}

function isSegmentAsLinestring(): boolean {
  const checkbox = document.getElementById(
    'segment-as-linestring'
  ) as HTMLInputElement | null;
  return checkbox?.checked ?? false;
}

export function exportData(): void {
  const selectedRoutes = store.routes.filter((r) => r.visible);

  if (selectedRoutes.length === 0) {
    alert('没有可导出的航线');
    return;
  }

  const format = getExportFormat();

  for (const route of selectedRoutes) {
    if (format === 'geojson' || isPolygonRoute(route)) {
      exportRouteGeoJSON(route);
    } else {
      exportRouteCsv(route);
    }
  }
}

export function exportSegment(): void {
  if (!store.segmentExport.startPoint || !store.segmentExport.endPoint) {
    alert('请先选择航段的起点和终点');
    return;
  }

  const route = store.getSelectedRoute();
  if (!route) {
    alert('请先选择一条航线');
    return;
  }

  const startSnap = snapToRoutes(
    L.latLng(
      store.segmentExport.startPoint.lat,
      store.segmentExport.startPoint.lon
    ),
    true,
    true
  );
  const endSnap = snapToRoutes(
    L.latLng(
      store.segmentExport.endPoint.lat,
      store.segmentExport.endPoint.lon
    ),
    true,
    true
  );

  let segmentPoints: Point[] | null = null;
  if (startSnap?.ref && endSnap?.ref) {
    segmentPoints = extractRouteSegment(
      route,
      { lat: startSnap.lat, lon: startSnap.lon, ref: startSnap.ref },
      { lat: endSnap.lat, lon: endSnap.lon, ref: endSnap.ref }
    );
  }

  if (!segmentPoints || segmentPoints.length < 2) {
    alert('无法从当前选择中提取有效的航段');
    return;
  }

  const format = getExportFormat();
  const prefix =
    startSnap?.ref && endSnap?.ref
      ? `${Math.min(startSnap.ref.segIdx, endSnap.ref.segIdx) + 1}-${Math.max(startSnap.ref.segIdx, endSnap.ref.segIdx) + 1}`
      : 'segment';

  if (format === 'geojson' || isPolygonRoute(route)) {
    if (isPolygonRoute(route)) {
      if (isSegmentAsLinestring()) {
        downloadGeoJSON(
          createLineGeoJSONData(segmentPoints, {
            sourceRoute: route.name,
            segment: true,
          }),
          `${route.name}_${prefix}.geojson`
        );
      } else {
        downloadGeoJSON(
          createPolygonSegmentGeoJSONData(segmentPoints, {
            sourceRoute: route.name,
            segment: true,
          }),
          `${route.name}_${prefix}.geojson`
        );
      }
    } else if (isBidirectionalExport()) {
      exportForwardReverseGeoJSON(segmentPoints, route.name, prefix);
    } else {
      exportSingleGeoJSON(segmentPoints, route.name, prefix);
    }
  } else if (isBidirectionalExport()) {
    exportForwardReverseCsv(segmentPoints, route.name, prefix);
  } else {
    exportSingleCsv(segmentPoints, route.name, prefix);
  }
}
