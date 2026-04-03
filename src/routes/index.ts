/**
 * 航线管理模块
 */

import {
  GeometryType,
  getMinimumRoutePoints,
  getRouteGeometryDisplayName,
  getRouteGeometryType,
  Point,
  Route,
  store,
} from '../state/store';
import {
  refreshRoutesList,
  setUIRefreshFunctions,
  updatePropertiesPanel,
  updateRouteDisplayGeometry,
} from './geometry';
import { setStatus } from '../utils/uiStatus';

// 导出 UI 刷新函数供其他模块使用
export { setUIRefreshFunctions };

/**
 * 添加航线
 */
export function addRoute(
  name: string,
  points: Point[],
  options: {
    geometryType?: GeometryType;
    holes?: Point[][];
  } = {}
): Route {
  const route = store.addRoute(name, points, options);
  // 初始化热力图选项
  import('../tools/heatmap')
    .then((m) => m.initRouteHeatOptions(route))
    .catch((err) => console.error('Failed to initialize heat options:', err));
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

function clearRouteDisplay(route: Route): void {
  route._display?.layer?.remove();
  route._display?.markers.forEach((marker) => marker.remove());
  if (route._display) {
    route._display.layer = null;
    route._display.markers = [];
  }
}

function buildGeometryTypeChangeError(
  route: Route,
  geometryType: GeometryType
): string | null {
  const minPoints = getMinimumRoutePoints(geometryType);
  if (route.points.length >= minPoints) {
    return null;
  }

  if (geometryType === 'point') {
    return '点类型至少需要 1 个点';
  }

  if (geometryType === 'polygon') {
    return `航线“${route.name}”至少需要 3 个点才能改为多边形`;
  }

  return `航线“${route.name}”至少需要 2 个点才能改为折线`;
}

export function changeRouteGeometryType(
  routeId: string,
  geometryType: GeometryType
): { ok: boolean; message: string } {
  const route = store.getRouteById(routeId);
  if (!route) {
    return { ok: false, message: '找不到要修改的航线' };
  }

  const currentGeometryType = getRouteGeometryType(route);
  if (currentGeometryType === geometryType) {
    return { ok: true, message: '航线类型未发生变化' };
  }

  const errorMessage = buildGeometryTypeChangeError(route, geometryType);
  if (errorMessage) {
    setStatus(errorMessage);
    return { ok: false, message: errorMessage };
  }

  clearRouteDisplay(route);
  store.clearEditHandle();
  store.selectedPoint = null;
  route.geometryType = geometryType;
  route.holes = geometryType === 'polygon' ? (route.holes ?? []) : [];
  route._distCache = undefined;
  route._holeDistCaches = undefined;

  if (route.visible) {
    updateRouteDisplayGeometry(route);
  }

  store.segmentExport.startPoint = null;
  store.segmentExport.endPoint = null;

  import('../tools/segment')
    .then((module) => module.clearSegmentExport())
    .catch(() => undefined);
  import('../tools/measure')
    .then((module) => module.clearMeasure())
    .catch(() => undefined);

  refreshRoutesList();
  updatePropertiesPanel();

  const displayName = getRouteGeometryDisplayName(
    geometryType,
    route.points.length
  );
  const message = `已将航线“${route.name}”切换为${displayName}`;
  setStatus(message);
  return { ok: true, message };
}

/**
 * 合并两条航线为一条航线
 * 将第二条航线的点连接到第一条航线的末尾
 * @param routeId1 第一条航线ID（保留）
 * @param routeId2 第二条航线ID（将被删除）
 * @returns 合并后的航线，如果失败返回null
 */
export function mergeRoutes(routeId1: string, routeId2: string): Route | null {
  const route1 = store.getRouteById(routeId1);
  const route2 = store.getRouteById(routeId2);

  if (!route1 || !route2) {
    console.error('无法找到要合并的航线');
    return null;
  }

  if (route1.id === route2.id) {
    console.error('不能合并同一条航线');
    return null;
  }

  const geometryType1 = getRouteGeometryType(route1);
  const geometryType2 = getRouteGeometryType(route2);
  if (geometryType1 !== 'polyline' || geometryType2 !== 'polyline') {
    console.error('当前仅支持合并折线，暂不支持多边形合并');
    return null;
  }

  // 将第二条航线的点合并到第一条航线
  const mergedPoints = [...route1.points, ...route2.points];

  // 更新第一条航线的点
  route1.points = mergedPoints;

  // 清除距离缓存
  route1._distCache = undefined;

  // 移除第二条航线的显示图层
  if (route2._display?.layer) {
    route2._display.layer.remove();
  }
  route2._display?.markers.forEach((m) => m.remove());

  // 移除热力图层
  if (route2.heatLayer) {
    route2.heatLayer.remove();
    route2.heatLayer = null;
  }

  // 删除第二条航线
  store.removeRoute(routeId2);

  // 更新第一条航线的显示几何
  updateRouteDisplayGeometry(route1);

  // 刷新 UI
  refreshRoutesList();
  updatePropertiesPanel();

  return route1;
}

// 挂载全局函数（用于向后兼容）
(window as unknown as Record<string, unknown>).addRoute = addRoute;
(window as unknown as Record<string, unknown>).deleteRoute = deleteRoute;
(window as unknown as Record<string, unknown>).toggleRouteVisibility =
  toggleRouteVisibility;
