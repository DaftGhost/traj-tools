/**
 * 导入模块 - 处理 CSV、GeoJSON、WKT 文件导入
 */

import Papa from 'papaparse';
import { store, Point, GeometryType } from '../state/store';
import { addRoute } from '../routes/index';
import { fitAllRoutes, fitRoute } from '../map';
import { stripClosingPoint } from '../utils/geo';

interface ParsedPoint {
  lat: number;
  lon: number;
  [key: string]: unknown;
}

interface ParsedRouteGeometry {
  points: Point[];
  geometryType: GeometryType;
  holes?: Point[][];
  name?: string;
}

// GeoJSON 类型定义
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

interface GeoJSONMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

interface GeoJSONGeometryCollection {
  type: 'GeometryCollection';
  geometries: Array<GeoJSONPoint | GeoJSONMultiPoint | GeoJSONLineString | GeoJSONMultiLineString | GeoJSONPolygon | GeoJSONMultiPolygon>;
}

type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONMultiPoint
  | GeoJSONLineString
  | GeoJSONMultiLineString
  | GeoJSONPolygon
  | GeoJSONMultiPolygon
  | GeoJSONGeometryCollection;

interface GeoJSONFeature {
  type: 'Feature';
  geometry?: GeoJSONGeometry;
  properties?: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * 解析 CSV 文件
 */
export async function parseCsvFile(file: File): Promise<ParsedPoint[]> {
  console.log('[parseCsvFile] Starting parse of:', file.name);
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('[parseCsvFile] Results data length:', results.data.length);
        console.log('[parseCsvFile] First row keys:', results.data.length > 0 ? Object.keys(results.data[0] as object) : 'none');
        const points: ParsedPoint[] = [];

        for (const row of results.data as Record<string, unknown>[]) {
          // 检测所有可能的经纬度列名
          const latKey = detectLatKey(row);
          const lonKey = detectLonKey(row);
          console.log('[parseCsvFile] Detected latKey:', latKey, 'lonKey:', lonKey);
          
          if (latKey && lonKey) {
            const lat = parseCoordinate(row[latKey]);
            const lon = parseCoordinate(row[lonKey]);
            console.log('[parseCsvFile] Row values:', lat, lon);
            
            if (!isNaN(lat) && !isNaN(lon)) {
              // Spread row first, then override with parsed numeric lat/lon to ensure they're numbers
              points.push({ ...row, lat, lon });
            }
          }
        }

        console.log('[parseCsvFile] Total points parsed:', points.length);
        resolve(points);
      },
      error: (error) => reject(error)
    });
  });
}

function normalizeRing(ring: [number, number][]): Point[] {
  return stripClosingPoint(ring.map(([lon, lat]) => ({ lat, lon })));
}

function getGeometryName(properties?: Record<string, unknown>): string | undefined {
  if (!properties) return undefined;

  const candidates = ['name', 'title', 'routeName', 'id', 'Name', 'TITLE'];
  for (const key of candidates) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }

  return undefined;
}

/**
 * 检测纬度列名
 */
function detectLatKey(row: Record<string, unknown>): string | null {
  const patterns = ['纬度(度-分)', 'lat', 'latitude', '纬度', 'Lat', 'Latitude', 'y', 'Y'];
  for (const pattern of patterns) {
    if (row.hasOwnProperty(pattern)) return pattern;
    // 模糊匹配
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === pattern.toLowerCase()) return key;
      if (pattern !== '纬度(度-分)' && key.includes(pattern.toLowerCase())) return key;
    }
  }
  return null;
}

/**
 * 检测经度列名
 */
function detectLonKey(row: Record<string, unknown>): string | null {
  const patterns = ['经度(度-分)', 'lon', 'lng', 'longitude', '经度', 'Lon', 'Lng', 'Longitude', 'x', 'X'];
  for (const pattern of patterns) {
    if (row.hasOwnProperty(pattern)) return pattern;
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === pattern.toLowerCase()) return key;
      if (pattern !== '经度(度-分)' && key.includes(pattern.toLowerCase())) return key;
    }
  }
  return null;
}

/**
 * 解析坐标值（支持小数和度分格式）
 */
function parseCoordinate(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    console.log('[parseCoordinate] Parsing:', trimmed);
    
    // 尝试解析 "度-分" 格式（如 120-6.588E 或 31-38.183N）
    const dmsMatch = trimmed.match(/^(\d+)-(\d+(?:\.\d+)?)[EWNS]?$/i);
    if (dmsMatch) {
      const degrees = parseFloat(dmsMatch[1]);
      const minutes = parseFloat(dmsMatch[2]);
      const result = degrees + minutes / 60;
      console.log('[parseCoordinate] DMS parse result:', result);
      return result;
    }
    
    // 尝试解析传统度分秒格式（如 30°15'20" 或 30d15'20"）
    const tradMatch = trimmed.match(/(\d+)[°d](\d+)?[′']?(\d+)?["″]?\s*([NSEW])?/i);
    if (tradMatch) {
      const deg = parseFloat(tradMatch[1]);
      const min = tradMatch[2] ? parseFloat(tradMatch[2]) : 0;
      const sec = tradMatch[3] ? parseFloat(tradMatch[3]) : 0;
      let d = deg + min / 60 + sec / 3600;
      const dir = tradMatch[4];
      if (dir && (dir.toUpperCase() === 'S' || dir.toUpperCase() === 'W')) d = -d;
      console.log('[parseCoordinate] DMS traditional result:', d);
      return d;
    }
    
    const result = parseFloat(trimmed);
    console.log('[parseCoordinate] Float parse result:', result);
    return result;
  }
  return NaN;
}
export async function parseGeoJSONFile(file: File): Promise<ParsedRouteGeometry[]> {
  const text = await file.text();
  let geojson: GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection;
  try {
    geojson = JSON.parse(text);
  } catch {
    console.error('GeoJSON 文件格式错误：无法解析 JSON');
    return [];
  }

  return extractRoutesFromGeoJSON(geojson);
}

/**
 * 从 GeoJSON 中提取坐标点
 */
function extractRoutesFromGeoJSON(geojson: GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection): ParsedRouteGeometry[] {
  if (geojson.type === 'FeatureCollection') {
    return geojson.features.flatMap((feature) => {
      if (!feature.geometry) return [];
      return extractRoutesFromGeometry(feature.geometry, feature.properties);
    });
  }

  if (geojson.type === 'Feature') {
    if (!geojson.geometry) return [];
    return extractRoutesFromGeometry(geojson.geometry, geojson.properties);
  }

  return extractRoutesFromGeometry(geojson);
}

/**
 * 从几何对象中提取坐标数组
 */
function extractRoutesFromGeometry(
  geometry: GeoJSONGeometry,
  properties?: Record<string, unknown>
): ParsedRouteGeometry[] {
  const name = getGeometryName(properties);

  switch (geometry.type) {
    case 'Point': {
      const [lon, lat] = geometry.coordinates;
      return [{ points: [{ lat, lon }], geometryType: 'polyline', name }];
    }

    case 'MultiPoint': {
      return [{
        points: geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
        geometryType: 'polyline',
        name,
      }];
    }

    case 'LineString': {
      return [{
        points: geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
        geometryType: 'polyline',
        name,
      }];
    }

    case 'MultiLineString': {
      return geometry.coordinates.map((line, index) => ({
        points: line.map(([lon, lat]) => ({ lat, lon })),
        geometryType: 'polyline',
        name: geometry.coordinates.length > 1 && name ? `${name}_${index + 1}` : name,
      }));
    }

    case 'Polygon': {
      if (geometry.coordinates.length === 0) return [];

      const outer = normalizeRing(geometry.coordinates[0]);
      const holes = geometry.coordinates.slice(1).map(normalizeRing).filter((ring) => ring.length >= 3);
      return [{
        points: outer,
        geometryType: 'polygon',
        holes,
        name,
      }];
    }

    case 'MultiPolygon': {
      return geometry.coordinates.flatMap((polygon, index) => {
        if (polygon.length === 0) return [];

        const outer = normalizeRing(polygon[0]);
        const holes = polygon.slice(1).map(normalizeRing).filter((ring) => ring.length >= 3);
        return [{
          points: outer,
          geometryType: 'polygon',
          holes,
          name: geometry.coordinates.length > 1 && name ? `${name}_${index + 1}` : name,
        }];
      });
    }

    case 'GeometryCollection': {
      return geometry.geometries.flatMap((geom) => extractRoutesFromGeometry(geom, properties));
    }

    default:
      throw new Error(`不支持的 GeoJSON 类型: ${(geometry as GeoJSONGeometry).type}`);
  }
}

/**
 * 解析 WKT 文件
 */
export async function parseWKTFile(file: File): Promise<ParsedRouteGeometry[]> {
  const text = await file.text();
  const wktModule = await import('wellknown');

  if (!wktModule.parse) {
    throw new Error('WKT 解析器不可用');
  }

  const geojson = wktModule.parse(text.trim());
  if (!geojson) {
    throw new Error('无法解析 WKT 格式');
  }

  return extractRoutesFromGeoJSON(geojson as GeoJSONGeometry);
}

/**
 * 检测文件类型
 */
async function detectFileType(file: File): Promise<'csv' | 'geojson' | 'wkt' | 'unknown'> {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();

  console.log('[detectFileType] File:', file.name, 'ext:', ext);
  if (ext === 'csv') { console.log('detectFileType: csv detected'); return 'csv'; }
  if (ext === 'json' || ext === 'geojson') return 'geojson';
  if (ext === 'wkt') return 'wkt';

  // 尝试通过文件内容检测
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      console.log("detectFileType: content preview =", text.substring(0, 150));
      if (text.trim().startsWith('{')) {
        try {
          JSON.parse(text);
          resolve('geojson');
        } catch {
          resolve('unknown');
        }
      } else if (/^POINT|LINESTRING|POLYGON|MULTI/i.test(text.trim())) {
        resolve('wkt');
      } else {
        resolve('csv');
      }
    };
    reader.onerror = () => resolve('unknown');
    reader.readAsText(file.slice(0, 500));
  });
}

export async function parseFile(file: File): Promise<ParsedRouteGeometry[]> {
  console.log('[parseFile] Called with:', file.name);
  const fileType = await detectFileType(file);
  console.log('[parseFile] Detected type:', fileType);
  switch (fileType) {
    case 'geojson':
      return parseGeoJSONFile(file);
    case 'wkt':
      return parseWKTFile(file);
    case 'csv':
    default:
      return [{
        points: await parseCsvFile(file),
        geometryType: 'polyline',
      }];
  }
}

/**
 * 导入路由
 */
export async function importRoute(file: File): Promise<void> {
  const routeName = file.name.replace(/\.[^/.]+$/, '');
  const parsedRoutes = await parseFile(file);

  if (parsedRoutes.length === 0) {
    throw new Error('未能从文件中解析出可导入的几何对象');
  }

  const createdRoutes = parsedRoutes.map((parsed, index) => {
    const minPoints = parsed.geometryType === 'polygon' ? 3 : 2;
    if (parsed.points.length < minPoints) {
      throw new Error(parsed.geometryType === 'polygon'
        ? '多边形至少需要 3 个点'
        : '航点数量不足，至少需要 2 个点');
    }

    const name = parsed.name || (parsedRoutes.length === 1 ? routeName : `${routeName}_${index + 1}`);
    return addRoute(name, parsed.points.map((point) => ({ lat: point.lat, lon: point.lon })), {
      geometryType: parsed.geometryType,
      holes: parsed.holes?.map((ring) => ring.map((point) => ({ lat: point.lat, lon: point.lon }))),
    });
  });

  if (createdRoutes.length === 0) {
    throw new Error('导入失败：没有生成任何航线');
  }

  store.selectRoute(createdRoutes[0].id);

  if (createdRoutes.length === 1) {
    fitRoute(createdRoutes[0].id);
  } else {
    fitAllRoutes();
  }

  // 更新属性面板
  import('../ui/index').then(m => m.updatePropertiesPanel());
}
