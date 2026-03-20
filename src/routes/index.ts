/**
 * 航线管理模块
 */

import { store, Point, Route } from '../state/store';
import { updateRouteDisplayGeometry, setUIRefreshFunctions, refreshRoutesList, updatePropertiesPanel } from './geometry';

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
(window as unknown as Record<string, unknown>).toggleRouteVisibility = toggleRouteVisibility;
