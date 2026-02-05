/**
 * 导出模块 - 处理数据导出功能
 */

import Papa from 'papaparse';
import { store, Point } from '../state/store';
import { calculateBearing, bearingToDirection } from '../utils/geo';
import { swapLeftRight } from '../utils/helpers';

// GeoJSON 类型定义
interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONLineString;
  properties?: Record<string, unknown>;
}

interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

/**
 * 生成CSV数据
 */
function createCsvData(points: Point[]): Record<string, string>[] {
  return points.map((p, i) => ({
    纬度: Number(p.lat).toFixed(6),
    经度: Number(p.lon).toFixed(6),
    序号: String(i + 1)
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
 * 生成GeoJSON数据
 */
function createGeoJSONData(points: Point[]): GeoJSONFeatureCollection {
  const coordinates: [number, number][] = points.map(p => [p.lon, p.lat]);

  const lineString: GeoJSONLineString = {
    type: 'LineString',
    coordinates
  };

  const feature: GeoJSONFeature = {
    type: 'Feature',
    geometry: lineString,
    properties: {
      pointCount: points.length
    }
  };

  return {
    type: 'FeatureCollection',
    features: [feature]
  };
}

/**
 * 下载GeoJSON文件
 */
function downloadGeoJSON(data: GeoJSONFeatureCollection, filename: string): void {
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

/**
 * 导出正序和逆序CSV文件
 */
function exportForwardReverseCsv(points: Point[], baseName: string, prefix: string = ''): void {
  if (points.length < 2) {
    const csvData = createCsvData(points);
    const suffix = prefix ? '_' + prefix : '';
    downloadCsv(csvData, baseName + suffix + '.csv');
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
  const forwardName = prefix ? `${reverseDirection}_${direction}_${baseName}_${prefix}` : `${reverseDirection}_${direction}_${baseName}`;
  downloadCsv(forwardCsv, forwardName + '.csv');

  // Reverse file: filename shows where reversed route starts and ends
  // Example: S_N means starts at South (original end), ends at North (original start)
  // Also swap left/right in baseName and prefix for reversed routes
  const reversePoints = [...points].reverse();
  const reverseCsv = createCsvData(reversePoints);
  const reverseBaseName = swapLeftRight(baseName);
  const reversePrefix = swapLeftRight(prefix);
  const reverseName = reversePrefix ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}` : `${direction}_${reverseDirection}_${reverseBaseName}`;
  downloadCsv(reverseCsv, reverseName + '.csv');
}

/**
 * 导出正序和逆序GeoJSON文件
 */
function exportForwardReverseGeoJSON(points: Point[], baseName: string, prefix: string = ''): void {
  if (points.length < 2) {
    const geojsonData = createGeoJSONData(points);
    const suffix = prefix ? '_' + prefix : '';
    downloadGeoJSON(geojsonData, baseName + suffix + '.geojson');
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
  const forwardGeoJSON = createGeoJSONData(points);
  const forwardName = prefix ? `${reverseDirection}_${direction}_${baseName}_${prefix}` : `${reverseDirection}_${direction}_${baseName}`;
  downloadGeoJSON(forwardGeoJSON, forwardName + '.geojson');

  // Reverse file: filename shows where reversed route starts and ends
  // Example: S_N means starts at South (original end), ends at North (original start)
  // Also swap left/right in baseName and prefix for reversed routes
  const reversePoints = [...points].reverse();
  const reverseGeoJSON = createGeoJSONData(reversePoints);
  const reverseBaseName = swapLeftRight(baseName);
  const reversePrefix = swapLeftRight(prefix);
  const reverseName = reversePrefix ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}` : `${direction}_${reverseDirection}_${reverseBaseName}`;
  downloadGeoJSON(reverseGeoJSON, reverseName + '.geojson');
}

/**
 * 获取导出格式
 */
function getExportFormat(): 'csv' | 'geojson' {
  const select = document.getElementById('export-format') as unknown as HTMLSelectElement;
  return (select?.value as 'csv' | 'geojson') || 'csv';
}

export function exportData(): void {
  const selectedRoutes = store.routes.filter(r => r.visible);

  if (selectedRoutes.length === 0) {
    alert('没有可导出的航线');
    return;
  }

  const format = getExportFormat();

  for (const route of selectedRoutes) {
    if (format === 'geojson') {
      exportForwardReverseGeoJSON(route.points, route.name);
    } else {
      exportForwardReverseCsv(route.points, route.name);
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

  let minDist1 = Infinity, minDist2 = Infinity;
  let startIdx = -1, endIdx = -1;

  for (let i = 0; i < route.points.length; i++) {
    const p = route.points[i];
    const d1 = Math.sqrt((p.lat - store.segmentExport.startPoint!.lat) ** 2 + (p.lon - store.segmentExport.startPoint!.lon) ** 2);
    const d2 = Math.sqrt((p.lat - store.segmentExport.endPoint!.lat) ** 2 + (p.lon - store.segmentExport.endPoint!.lon) ** 2);
    if (d1 < minDist1) { minDist1 = d1; startIdx = i; }
    if (d2 < minDist2) { minDist2 = d2; endIdx = i; }
  }

  if (startIdx === -1 || endIdx === -1) {
    alert('无法找到对应的航点');
    return;
  }

  const min = Math.min(startIdx, endIdx);
  const max = Math.max(startIdx, endIdx);
  const segmentPoints = route.points.slice(min, max + 1);

  if (segmentPoints.length >= 2) {
    const format = getExportFormat();
    if (format === 'geojson') {
      exportForwardReverseGeoJSON(segmentPoints, route.name, (min + 1) + '-' + (max + 1));
    } else {
      exportForwardReverseCsv(segmentPoints, route.name, (min + 1) + '-' + (max + 1));
    }
  }
}
