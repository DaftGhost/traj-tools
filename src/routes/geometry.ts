/**
 * 航线几何计算模块
 * 包含简化、平滑、显示几何更新等功能
 */

import { store, Point, Route, SmoothDragContext, SmoothDragItem } from '../state/store';
import { SIMPLIFY_CONFIG, SMOOTH_CONFIG } from '../config/constants';
import { douglasPeuckerIndices, equidistantResample, haversineDistance, visvalingamWhyattIndices } from '../utils/geo';
import { buildMarkerIcon } from '../utils/markerIcon';
import * as L from 'leaflet';

// 平滑拖拽上下文存储
let smoothDragContext: SmoothDragContext | null = null;

// 临时拖拽标记（不创建大量 markers，只创建一个拖拽手柄）
let dragMarker: L.Marker | null = null;
let dragRouteId: string | null = null;
let dragPointIdx: number = -1;

/**
 * 构建平滑拖拽上下文
 * 使用累积沿线距离，只影响 radius 范围内的点
 * 保存每个点的原始位置 lat0, lon0 用于计算偏移量
 * 保存被移动点的原始位置 movedOrigin，用于计算总位移
 */
function buildSmoothDragContext(route: Route, movedIdx: number): SmoothDragContext | null {
  const radius = store.smoothRadius || SMOOTH_CONFIG.radiusMeters;
  const n = route.points.length;
  const moved = route.points[movedIdx];
  const items: SmoothDragItem[] = [{ idx: movedIdx, w: 1, lat0: moved.lat, lon0: moved.lon }];

  if (radius > 0 && store.map) {
    // 向后（索引递减方向）
    let cum = 0;
    for (let i = movedIdx - 1; i >= 0; i--) {
      const a = route.points[i + 1];
      const b = route.points[i];
      cum += store.map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;
      const w = Math.max(0, 1 - cum / radius);
      items.push({ idx: i, w, lat0: b.lat, lon0: b.lon });
    }

    // 向前（索引递增方向）
    cum = 0;
    for (let i = movedIdx + 1; i < n; i++) {
      const a = route.points[i - 1];
      const b = route.points[i];
      cum += store.map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;
      const w = Math.max(0, 1 - cum / radius);
      items.push({ idx: i, w, lat0: b.lat, lon0: b.lon });
    }
  }

  return {
    routeId: route.id,
    movedIdx,
    accumulatedDelta: { lat: 0, lon: 0 }, // 累积位移归零
    items,
  };
}

/**
 * 平滑更新点位置
 * 使用预计算的上下文，只更新受影响的点
 * 使用增量位移计算，每次拖拽时计算相对于当前点的位移
 */
function smoothUpdatePoint(route: Route, context: SmoothDragContext, newLat: number, newLon: number): void {
  // 计算本次拖拽的位移（增量）
  const currentLat = route.points[context.movedIdx].lat;
  const currentLon = route.points[context.movedIdx].lon;
  const dLat = newLat - currentLat;
  const dLon = newLon - currentLon;

  // 累积位移
  context.accumulatedDelta.lat += dLat;
  context.accumulatedDelta.lon += dLon;

  for (const it of context.items) {
    // 使用原始位置 + 累积位移
    const lat = it.lat0 + it.w * context.accumulatedDelta.lat;
    const lon = it.lon0 + it.w * context.accumulatedDelta.lon;
    route.points[it.idx].lat = lat;
    route.points[it.idx].lon = lon;

    // 实时获取 latlngs 并更新
    const latlngs = route._display?.layer?.getLatLngs() as L.LatLng[] | undefined;
    if (latlngs && latlngs[it.idx]) {
      latlngs[it.idx].lat = lat;
      latlngs[it.idx].lng = lon;
    }
  }

  // 使用 redraw() 而非 setLatLngs()
  route._display?.layer?.redraw();
}

/**
 * 更新航线的显示几何（简化版本）
 * 编辑模式下直接更新原始几何，不进行简化
 */
export function updateRouteDisplayGeometry(route: Route): void {
  if (!store.map) return;

  // 初始化 _display
  if (!route._display) {
    route._display = {
      simplified: [],
      layer: null,
      markers: [],
    };
  }

  // 编辑态：显示原始几何，保证编辑与导出一致
  if (route.editable) {
    route._display.simplified = route.points; // 使用所有原始点
    if (route._display.layer) {
      route._display.layer.setLatLngs(route.points.map((p) => [p.lat, p.lon] as L.LatLngExpression));
    }
    updateRouteLayer(route);
    return;
  }

  // Step 1: 等距重采样（10m 间隔），增加冗余点
  const resampled = equidistantResample(route.points, 10);

  const targetPoints = Math.max(
    SIMPLIFY_CONFIG.minPoints,
    Math.ceil(resampled.length * SIMPLIFY_CONFIG.retainRatio)
  );

  // Step 2: 对重采样结果进行简化
  let keepIndices = visvalingamWhyattIndices(resampled, targetPoints);

  // 兜底：若 VW 结果异常，回退到 Douglas-Peucker
  if (keepIndices.length < SIMPLIFY_CONFIG.minPoints || keepIndices.some((i) => i < 0 || i >= resampled.length)) {
    const zoom = store.map.getZoom();
    const tolerance = SIMPLIFY_CONFIG.tolerancePxForZoom(zoom);
    keepIndices = douglasPeuckerIndices(resampled, tolerance);
  }

  // 提取简化后的点
  const simplified = keepIndices.map((i) => resampled[i]);

  route._display.simplified = simplified;

  // 更新或创建图层
  updateRouteLayer(route);
}

/**
 * 更新航线的 Leaflet 图层
 */
function updateRouteLayer(route: Route): void {
  if (!store.map || !route._display) return;

  const map = store.map;

  // 移除旧图层
  if (route._display.layer) {
    route._display.layer.remove();
  }

  route._display.markers.forEach(m => m.remove());
  route._display.markers = [];

  // 过滤可见点
  const visiblePoints = route._display.simplified.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (visiblePoints.length === 0) return;

  // 创建新图层
  const latlngs = visiblePoints.map((p) => [p.lat, p.lon] as L.LatLngExpression);
  const polyline = L.polyline(latlngs, {
    color: route.color,
    weight: 3,
    opacity: 0.9,
  });

  // 如果热力图已启用且设置了隐藏航线，则不添加到地图
  if (route.heatEnabled && store.heatmap.hideRoute) {
    route._display.layer = polyline;
  } else {
    route._display.layer = polyline.addTo(map);
  }

  // 绑定点击事件
  route._display.layer.on('click', (e: L.LeafletMouseEvent) => {
    e.originalEvent.stopPropagation();
    store.selectRoute(route.id);
    refreshRoutesList();

    // 编辑模式下，点击航线找到最近的节点并创建拖拽标记
    if (route.editable && route.selected) {
      const nearestIdx = findNearestPointIndex(e.latlng, route);
      if (nearestIdx >= 0) {
        createDragMarker(route, nearestIdx, e.latlng);
      }
    }

    updatePropertiesPanel();
  });
}

/**
 * 找到航线中距离给定位置最近的节点索引
 */
function findNearestPointIndex(latlng: L.LatLng, route: Route): number {
  if (!store.map) return -1;

  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  let minDist = Infinity;
  let nearestIdx = -1;

  for (let i = 0; i < route.points.length; i++) {
    const p = route.points[i];
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const dist = haversineDistance(target, p);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
    }
  }

  return nearestIdx;
}

/**
 * 创建临时拖拽标记
 * 点击航线后创建，拖拽结束后移除
 */
function createDragMarker(route: Route, pointIdx: number, position: L.LatLng): void {
  // 移除旧的拖拽标记
  if (dragMarker) {
    dragMarker.remove();
    dragMarker = null;
  }

  dragRouteId = route.id;
  dragPointIdx = pointIdx;

  // 创建临时拖拽标记
  dragMarker = L.marker(position, {
    draggable: true,
    icon: buildMarkerIcon(route.color, true),
  }).addTo(store.map!);

  // 设置编辑句柄
  store.setEditHandle(route.id, pointIdx, dragMarker);

  // 选中该节点
  store.selectPoint(route.id, pointIdx);
  updatePropertiesPanel();

  // 显示状态
  const statusEl = document.getElementById('status-selection');
  if (statusEl) {
    statusEl.textContent = `选中节点: ${pointIdx + 1}`;
  }

  // 拖拽开始
  dragMarker.on('dragstart', () => {
    const point = route.points[pointIdx];
    store.dragContext = { startLat: point.lat, startLon: point.lon };
    // 构建平滑拖拽上下文，保存被移动点的原始位置
    smoothDragContext = buildSmoothDragContext(route, pointIdx);
  });

  // 拖拽中
  dragMarker.on('drag', (e: L.LeafletEvent) => {
    const mouseEvent = e as unknown as L.LeafletMouseEvent;
    if (smoothDragContext && dragRouteId) {
      smoothUpdatePoint(route, smoothDragContext, mouseEvent.latlng.lat, mouseEvent.latlng.lng);
      // 实时更新属性面板中的点坐标
      updatePropertiesPanel();
    }
  });

  // 拖拽结束
  dragMarker.on('dragend', () => {
    store.dragContext = null;
    smoothDragContext = null;
    route._distCache = undefined;

    // 移除拖拽标记
    if (dragMarker) {
      dragMarker.remove();
      dragMarker = null;
    }
    dragRouteId = null;
    dragPointIdx = -1;
    store.clearEditHandle();

    // 更新显示几何
    updateRouteDisplayGeometry(route);
    refreshRoutesList();
    updatePropertiesPanel();
  });
}

/**
 * 刷新所有航线的显示几何
 */
export function refreshAllRouteDisplayGeometry(): void {
  store.routes.forEach((route) => {
    if (route.visible) {
      updateRouteDisplayGeometry(route);
    }
  });
}

/**
 * 清除拖拽标记
 * 关闭编辑模式时调用
 */
export function clearDragMarker(): void {
  if (dragMarker) {
    dragMarker.remove();
    dragMarker = null;
  }
  dragRouteId = null;
  dragPointIdx = -1;
  smoothDragContext = null;
  store.clearEditHandle();
}

// UI 刷新函数（将在 UI 模块中实现）
export let refreshRoutesList: () => void = () => {};
export let updatePropertiesPanel: () => void = () => {};

export function setUIRefreshFunctions(refreshList: () => void, updatePanel: () => void): void {
  refreshRoutesList = refreshList;
  updatePropertiesPanel = updatePanel;
}

/**
 * 添加节点到航线末尾
 */
export function addNodeToRoute(routeId: string, lat: number, lon: number): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  // 添加新点到末尾
  route.points.push({ lat, lon });

  // 更新显示几何
  updateRouteDisplayGeometry(route);

  // 选中新添加的点
  store.selectPoint(routeId, route.points.length - 1);

  // 刷新UI
  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 在航线开头添加节点（绝对首点前插）
 */
export function prependNodeToRoute(routeId: string, lat: number, lon: number): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  clearDragMarker();

  route.points.unshift({ lat, lon });
  route._distCache = undefined;

  updateRouteDisplayGeometry(route);
  store.selectPoint(routeId, 0);

  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 选中航线端点并创建可拖拽编辑句柄
 */
export function selectRouteEndpoint(routeId: string, endpoint: 'start' | 'end'): boolean {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable || route.points.length === 0 || !store.map) {
    return false;
  }

  const pointIdx = endpoint === 'start' ? 0 : route.points.length - 1;
  const point = route.points[pointIdx];

  createDragMarker(route, pointIdx, L.latLng(point.lat, point.lon));
  return true;
}

/**
 * 删除指定索引节点
 */
export function deleteNodeFromRoute(routeId: string, pointIdx: number): boolean {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return false;
  if (pointIdx < 0 || pointIdx >= route.points.length) return false;

  clearDragMarker();

  route.points.splice(pointIdx, 1);
  route._distCache = undefined;

  const selected = store.selectedPoint;
  if (selected && selected.routeId === routeId) {
    if (selected.pointIdx === pointIdx) {
      store.selectedPoint = null;
    } else if (selected.pointIdx > pointIdx) {
      store.selectPoint(routeId, selected.pointIdx - 1);
    }
  }

  updateRouteDisplayGeometry(route);
  refreshRoutesList();
  updatePropertiesPanel();
  return true;
}

/**
 * 在指定索引处插入节点
 */
export function insertNodeAt(routeId: string, lat: number, lon: number, afterIdx: number): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  // 在指定位置后插入新点
  route.points.splice(afterIdx + 1, 0, { lat, lon });

  // 清除距离缓存
  route._distCache = undefined;

  // 更新显示几何
  updateRouteDisplayGeometry(route);

  // 选中新添加的点
  store.selectPoint(routeId, afterIdx + 1);

  // 刷新UI
  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 更新航线的累计距离缓存
 */
export function updateRouteDistanceCache(route: Route): void {
  if (!route._distCache || route._distCache.length !== route.points.length) {
    route._distCache = new Array(route.points.length).fill(0);
  }

  let cumulative = 0;
  route._distCache[0] = 0;

  for (let i = 1; i < route.points.length; i++) {
    const prev = route.points[i - 1];
    const curr = route.points[i];
    const dist = haversineDistance(prev, curr);
    cumulative += dist;
    route._distCache[i] = cumulative;
  }
}

/**
 * 获取航线上两点之间的累计距离
 * @param route 航线
 * @param idx1 起点索引
 * @param idx2 终点索引
 * @returns 累计距离（米），如果索引无效返回 null
 */
export function getRouteCumulativeDistance(route: Route, idx1: number, idx2: number): number | null {
  if (!route._distCache || idx1 < 0 || idx2 < 0 || idx1 >= route.points.length || idx2 >= route.points.length) {
    // 尝试更新缓存
    if (route.points.length >= 2) {
      updateRouteDistanceCache(route);
      if (route._distCache) {
        return Math.abs(route._distCache[idx1] - route._distCache[idx2]);
      }
    }
    return null;
  }

  return Math.abs(route._distCache[idx1] - route._distCache[idx2]);
}

/**
 * 计算点到线段的最短距离（米）
 * 使用球面几何计算点到线段的距离
 */
function distanceToSegment(point: L.LatLng, a: Point, b: Point): number {
  // 如果两点相同，直接返回到点的距离
  if (a.lat === b.lat && a.lon === b.lon) {
    return haversineDistance({ lat: point.lat, lon: point.lng }, a);
  }

  const R = 6371000; // 地球半径（米）

  // 转换为弧度
  const lat = point.lat * Math.PI / 180;
  const lng = point.lng * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lon1 = a.lon * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const lon2 = b.lon * Math.PI / 180;

  // 线段的归一化方向向量
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // 计算点在线段上的投影参数 t
  const t = ((lng - lon1) * dLon + (lat - lat1) * dLat) / (dLon * dLon + dLat * dLat);

  // 将 t 限制在线段范围内 [0, 1]
  const tClamped = Math.max(0, Math.min(1, t));

  // 投影点的坐标
  const projLat = lat1 + tClamped * dLat;
  const projLng = lon1 + tClamped * dLon;

  // 使用球面距离公式计算距离
  const sinDLat = Math.sin((projLat - lat) / 2);
  const sinDLng = Math.sin((projLng - lng) / 2);
  const sinD = Math.sqrt(sinDLat * sinDLat + Math.cos(lat) * Math.cos(projLat) * sinDLng * sinDLng);

  return 2 * R * Math.asin(sinD);
}

/**
 * 找到距离点击位置最近的航线段索引
 * 返回段终点索引（即在该索引后插入）
 */
export function findNearestSegmentIndex(latlng: L.LatLng, route: Route): number {
  if (!store.map || route.points.length < 2) return -1;

  let minDist = Infinity;
  let nearestIdx = -1;

  for (let i = 0; i < route.points.length - 1; i++) {
    const p1 = route.points[i];
    const p2 = route.points[i + 1];
    const dist = distanceToSegment(latlng, p1, p2);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i; // 在 p1 和 p2 之间插入
    }
  }

  return nearestIdx;
}
