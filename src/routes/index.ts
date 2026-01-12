/**
 * 航线管理模块
 */

import { store, Point, Route } from '../state/store';
import { updateRouteDisplayGeometry, setUIRefreshFunctions, refreshRoutesList, updatePropertiesPanel } from './geometry';
import { formatFileName, getFileExtension } from '../utils/helpers';
import { fitRoute } from '../map';
import Papa from 'papaparse';

// 导出 UI 刷新函数供其他模块使用
export { setUIRefreshFunctions };

/**
 * 添加航线
 */
export function addRoute(name: string, points: Point[]): Route {
  const route = store.addRoute(name, points);
  // 初始化热力图选项
  import('../tools/heatmap')
    .then(m => m.initRouteHeatOptions(route))
    .catch(err => console.error('Failed to initialize heat options:', err));
  updateRouteDisplayGeometry(route);
  // 刷新 UI
  refreshRoutesList();
  // 如果有选中的航线，更新属性面板
  if (store.selectedRouteId) {
    updatePropertiesPanel();
  }
  return route;
}

/**
 * 从文件导入航线
 */
export async function importRouteFromFile(file: File): Promise<Route | null> {
  const extension = getFileExtension(file.name);
  let points: Point[] = [];

  if (extension === 'csv') {
    points = await parseCsvFile(file);
  } else if (extension === 'geojson' || extension === 'json') {
    points = await parseGeoJsonFile(file);
  } else {
    console.error('不支持的文件格式:', extension);
    return null;
  }

  if (points.length === 0) {
    console.error('解析后没有有效坐标点');
    return null;
  }

  const route = addRoute(formatFileName(file.name), points);
  return route;
}

/**
 * 解析 CSV 文件
 */
async function parseCsvFile(file: File): Promise<Point[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        const points: Point[] = [];

        const data = results.data;

        if (data.length === 0) {
          resolve([]);
          return;
        }

        // 自动检测经纬度列名
        const latKey = detectLatLonKey(data[0], 'lat');
        const lonKey = detectLatLonKey(data[0], 'lon');

        if (!latKey || !lonKey) {
          console.error('无法检测到经纬度列');
          resolve([]);
          return;
        }

        for (const row of data) {
          const latStr = row[latKey];
          const lonStr = row[lonKey];

          if (latStr && lonStr) {
            const coord = parseCoordinate(latStr, lonStr);
            if (coord) {
              points.push(coord);
            }
          }
        }

        resolve(points);
      },
      error: (error: Error) => {
        console.error('CSV 解析错误:', error);
        reject(error);
      },
    });
  });
}

/**
 * 解析 GeoJSON 文件
 */
async function parseGeoJsonFile(file: File): Promise<Point[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        const points: Point[] = [];

        if (geojson.type === 'FeatureCollection') {
          geojson.features.forEach((feature: GeoJSON.Feature) => {
            const featurePoints = parseGeoJsonGeometry(feature.geometry);
            points.push(...featurePoints);
          });
        } else if (geojson.type === 'Feature') {
          points.push(...parseGeoJsonGeometry(geojson.geometry));
        } else if (geojson.type === 'LineString') {
          points.push(...parseGeoJsonGeometry(geojson));
        }

        resolve(points);
      } catch (error) {
        console.error('GeoJSON 解析错误:', error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

/**
 * 解析 GeoJSON 几何对象
 */
function parseGeoJsonGeometry(geometry: GeoJSON.Geometry): Point[] {
  const points: Point[] = [];

  if (geometry.type === 'LineString' && geometry.coordinates) {
    geometry.coordinates.forEach((coord) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        points.push({ lon: coord[0], lat: coord[1] });
      }
    });
  } else if (geometry.type === 'MultiLineString' && geometry.coordinates) {
    geometry.coordinates.forEach((line) => {
      line.forEach((coord) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          points.push({ lon: coord[0], lat: coord[1] });
        }
      });
    });
  }

  return points;
}

/**
 * 检测经纬度列名
 */
function detectLatLonKey(
  row: Record<string, string>,
  type: 'lat' | 'lon'
): string | null {
  // 优先级高的模式（更具体的列名优先匹配）
  const latPatterns = [
    '纬度(度-分)',    // 度分格式列
    'lat', 'latitude', '纬度', 'y'
  ];
  const lonPatterns = [
    '经度(度-分)',    // 度分格式列
    'lon', 'lng', 'longitude', '经度', 'x'
  ];

  const patterns = type === 'lat' ? latPatterns : lonPatterns;

  for (const pattern of patterns) {
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === pattern.toLowerCase() || lowerKey.includes(pattern.toLowerCase())) {
        return key;
      }
    }
  }

  return null;
}

/**
 * 解析坐标字符串
 */
function parseCoordinate(latStr: string, lonStr: string): Point | null {
  const lat = parseCoordinateValue(latStr);
  const lon = parseCoordinateValue(lonStr);

  if (lat === null || lon === null) return null;

  return { lat, lon };
}

/**
 * 解析坐标值（支持度分格式）
 */
function parseCoordinateValue(value: string): number | null {
  const trimmed = value.trim();
  const num = parseFloat(trimmed);

  if (!isNaN(num)) return num;

  // 尝试解析 "度-分" 格式（如 120-6.588E 或 31-38.183N）
  const dmsMatch = trimmed.match(/^(\d+)-(\d+(?:\.\d+)?)[EWNS]?$/i);
  if (dmsMatch) {
    const degrees = parseFloat(dmsMatch[1]);
    const minutes = parseFloat(dmsMatch[2]);
    return degrees + minutes / 60;
  }

  // 尝试解析传统度分格式（如 30°15'20" 或 30d15'20"）
  const tradMatch = trimmed.match(/(\d+)[°d](\d+)?[′']?(\d+)?["″]?/);
  if (tradMatch) {
    const degrees = parseFloat(tradMatch[1]);
    const minutes = tradMatch[2] ? parseFloat(tradMatch[2]) : 0;
    const seconds = tradMatch[3] ? parseFloat(tradMatch[3]) : 0;
    return degrees + minutes / 60 + seconds / 3600;
  }

  return null;
}

/**
 * 删除航线
 */
export function deleteRoute(routeId: string): void {
  const route = store.getRouteById(routeId);
  if (!route) return;

  // 移除显示图层
  if (route._display?.layer) {
    route._display.layer.remove();
  }
  route._display?.markers.forEach((m) => m.remove());

  // 移除数据
  store.removeRoute(routeId);
}

/**
 * 切换航线可见性
 */
export function toggleRouteVisibility(routeId: string): void {
  const route = store.getRouteById(routeId);
  if (!route) return;

  route.visible = !route.visible;

  if (route.visible) {
    updateRouteDisplayGeometry(route);
  } else {
    if (route._display?.layer) {
      route._display.layer.remove();
    }
    route._display?.markers.forEach((m) => m.remove());
  }
}

// 挂载全局函数（用于向后兼容）
(window as unknown as Record<string, unknown>).addRoute = addRoute;
(window as unknown as Record<string, unknown>).deleteRoute = deleteRoute;
(window as unknown as Record<string, unknown>).toggleRouteVisibility = toggleRouteVisibility;
