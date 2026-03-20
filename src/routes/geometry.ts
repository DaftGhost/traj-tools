/**
 * 航线几何计算模块
 * 包含简化、平滑、显示几何更新等功能
 */

import {
  store,
  Point,
  Route,
  SmoothDragContext,
  SmoothDragItem,
  getPointsForRing,
  setPointsForRing,
  getRouteGeometryType,
  isPolygonRoute,
} from '../state/store';
import { SIMPLIFY_CONFIG, SMOOTH_CONFIG } from '../config/constants';
import {
  douglasPeuckerIndices,
  equidistantResample,
  equidistantResampleClosed,
  haversineDistance,
  stripClosingPoint,
  visvalingamWhyattIndices,
} from '../utils/geo';
import { buildMarkerIcon } from '../utils/markerIcon';
import * as L from 'leaflet';

type RingSelection = {
  ringIndex: number;
  pointIdx: number;
};

// 平滑拖拽上下文存储
let smoothDragContext: SmoothDragContext | null = null;

// 临时拖拽标记（不创建大量 markers，只创建一个拖拽手柄）
let dragMarker: L.Marker | null = null;
let dragRouteId: string | null = null;
let dragPointIdx: number = -1;
let dragRingIndex = 0;

function ensureDisplay(route: Route): NonNullable<Route['_display']> {
  if (!route._display) {
    route._display = {
      simplified: [],
      holes: [],
      layer: null,
      markers: [],
    };
  } else if (!route._display.holes) {
    route._display.holes = [];
  }

  return route._display;
}

function invalidateRouteDistanceCaches(route: Route): void {
  route._distCache = undefined;
  route._holeDistCaches = undefined;
}

function getDisplayRing(route: Route, ringIndex: number): Point[] {
  if (ringIndex === 0) {
    return route._display?.simplified ?? route.points;
  }

  return route._display?.holes?.[ringIndex - 1] ?? route.holes?.[ringIndex - 1] ?? [];
}

function getRouteRingsForDisplay(route: Route): Point[][] {
  const rings = [route._display?.simplified ?? route.points];
  const displayHoles = route._display?.holes ?? route.holes ?? [];
  return rings.concat(displayHoles);
}

function getLatLngArrayForRing(layer: L.Polyline | L.Polygon | null, ringIndex: number): L.LatLng[] | null {
  if (!layer) return null;

  const latlngs = layer.getLatLngs() as unknown;
  if (!Array.isArray(latlngs)) return null;

  const first = latlngs[0];
  if (Array.isArray(first)) {
    return (latlngs as L.LatLng[][])[ringIndex] ?? null;
  }

  return ringIndex === 0 ? (latlngs as L.LatLng[]) : null;
}

function simplifyOpenPath(points: Point[]): Point[] {
  if (points.length <= 2) {
    return points.map((point) => ({ ...point }));
  }

  const resampled = equidistantResample(points, 10);
  const targetPoints = Math.max(
    SIMPLIFY_CONFIG.minPoints,
    Math.ceil(resampled.length * SIMPLIFY_CONFIG.retainRatio)
  );

  let keepIndices = visvalingamWhyattIndices(resampled, targetPoints);

  if (keepIndices.length < SIMPLIFY_CONFIG.minPoints || keepIndices.some((i) => i < 0 || i >= resampled.length)) {
    const zoom = store.map?.getZoom() ?? 8;
    const tolerance = SIMPLIFY_CONFIG.tolerancePxForZoom(zoom);
    keepIndices = douglasPeuckerIndices(resampled, tolerance);
  }

  return keepIndices.map((index) => ({ ...resampled[index] }));
}

function simplifyClosedRing(points: Point[]): Point[] {
  if (points.length <= 3) {
    return points.map((point) => ({ ...point }));
  }

  const resampled = equidistantResampleClosed(points, 10);
  const targetPoints = Math.max(
    4,
    Math.ceil(resampled.length * SIMPLIFY_CONFIG.retainRatio)
  );

  let keepIndices = visvalingamWhyattIndices(resampled, targetPoints);

  if (keepIndices.length < 4 || keepIndices.some((i) => i < 0 || i >= resampled.length)) {
    const zoom = store.map?.getZoom() ?? 8;
    const tolerance = SIMPLIFY_CONFIG.tolerancePxForZoom(zoom);
    keepIndices = douglasPeuckerIndices(resampled, tolerance);
  }

  const simplifiedClosed = keepIndices.map((index) => ({ ...resampled[index] }));
  const simplified = stripClosingPoint(simplifiedClosed);

  return simplified.length >= 3 ? simplified : points.map((point) => ({ ...point }));
}

function getPointSelection(route: Route, ringIndex: number, pointIdx: number): { routeId: string; pointIdx: number; ringIndex?: number } {
  return isPolygonRoute(route)
    ? { routeId: route.id, pointIdx, ringIndex }
    : { routeId: route.id, pointIdx };
}

function selectRoutePoint(route: Route, ringIndex: number, pointIdx: number): void {
  const selection = getPointSelection(route, ringIndex, pointIdx);
  store.selectPoint(selection.routeId, selection.pointIdx, selection.ringIndex);
}

function setRouteEditHandle(route: Route, ringIndex: number, pointIdx: number, marker: L.Marker): void {
  const selection = getPointSelection(route, ringIndex, pointIdx);
  store.setEditHandle(selection.routeId, selection.pointIdx, marker, selection.ringIndex);
}

function buildDistanceCache(points: Point[], closed: boolean): number[] {
  if (points.length === 0) return [];

  const cacheLength = closed ? points.length + 1 : points.length;
  const cache = new Array(cacheLength).fill(0);
  let cumulative = 0;

  for (let i = 1; i < points.length; i++) {
    cumulative += haversineDistance(points[i - 1], points[i]);
    cache[i] = cumulative;
  }

  if (closed && points.length > 1) {
    cumulative += haversineDistance(points[points.length - 1], points[0]);
    cache[points.length] = cumulative;
  }

  return cache;
}

function getDistanceCacheForRing(route: Route, ringIndex: number): number[] | undefined {
  if (!route._distCache) {
    updateRouteDistanceCache(route);
  }

  return ringIndex === 0 ? route._distCache : route._holeDistCaches?.[ringIndex - 1];
}

export function getRouteSegment(route: Route, segIdx: number, ringIndex: number = 0): { start: Point; end: Point; closed: boolean } | null {
  const points = getPointsForRing(route, ringIndex);
  const closed = isPolygonRoute(route);

  if (points.length < 2 || segIdx < 0) {
    return null;
  }

  const nextIdx = closed ? (segIdx + 1) % points.length : segIdx + 1;
  if (nextIdx < 0 || nextIdx >= points.length || segIdx >= points.length) {
    return null;
  }

  return {
    start: points[segIdx],
    end: points[nextIdx],
    closed,
  };
}

function getDisplayLatLngs(route: Route): L.LatLngExpression[] | L.LatLngExpression[][] {
  const outer = route._display?.simplified ?? route.points;
  const outerLatLngs = outer.map((point) => [point.lat, point.lon] as L.LatLngExpression);

  if (!isPolygonRoute(route)) {
    return outerLatLngs;
  }

  const holes = route._display?.holes ?? route.holes ?? [];
  const holeLatLngs = holes
    .map((ring) => ring.map((point) => [point.lat, point.lon] as L.LatLngExpression))
    .filter((ring) => ring.length >= 3);

  if (holeLatLngs.length === 0) {
    return outerLatLngs;
  }

  return [outerLatLngs, ...holeLatLngs];
}

/**
 * 构建平滑拖拽上下文
 * 使用累积沿线距离，只影响 radius 范围内的点
 * 保存每个点的原始位置 lat0, lon0 用于计算偏移量
 */
function buildSmoothDragContext(route: Route, movedIdx: number, ringIndex: number = 0): SmoothDragContext | null {
  const radius = store.smoothRadius || SMOOTH_CONFIG.radiusMeters;
  const points = getPointsForRing(route, ringIndex);
  const pointCount = points.length;
  const moved = points[movedIdx];

  if (!moved) return null;

  const items: SmoothDragItem[] = [{ idx: movedIdx, w: 1, lat0: moved.lat, lon0: moved.lon }];
  const closed = isPolygonRoute(route);

  if (radius > 0 && store.map) {
    const visited = new Set<number>([movedIdx]);

    let cum = 0;
    let currentIdx = movedIdx;
    while (true) {
      let prevIdx = currentIdx - 1;
      if (closed && prevIdx < 0) prevIdx = pointCount - 1;
      if (prevIdx < 0 || prevIdx >= pointCount || visited.has(prevIdx)) break;

      const a = points[currentIdx];
      const b = points[prevIdx];
      cum += store.map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;

      visited.add(prevIdx);
      items.push({ idx: prevIdx, w: Math.max(0, 1 - cum / radius), lat0: b.lat, lon0: b.lon });
      currentIdx = prevIdx;
    }

    cum = 0;
    currentIdx = movedIdx;
    while (true) {
      let nextIdx = currentIdx + 1;
      if (closed && nextIdx >= pointCount) nextIdx = 0;
      if (nextIdx < 0 || nextIdx >= pointCount || visited.has(nextIdx)) break;

      const a = points[currentIdx];
      const b = points[nextIdx];
      cum += store.map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;

      visited.add(nextIdx);
      items.push({ idx: nextIdx, w: Math.max(0, 1 - cum / radius), lat0: b.lat, lon0: b.lon });
      currentIdx = nextIdx;
    }
  }

  return {
    routeId: route.id,
    movedIdx,
    ringIndex,
    accumulatedDelta: { lat: 0, lon: 0 },
    items,
  };
}

/**
 * 平滑更新点位置
 * 使用预计算的上下文，只更新受影响的点
 */
function smoothUpdatePoint(route: Route, context: SmoothDragContext, newLat: number, newLon: number): void {
  const ringIndex = context.ringIndex ?? 0;
  const points = getPointsForRing(route, ringIndex);
  const movedPoint = points[context.movedIdx];
  if (!movedPoint) return;

  const dLat = newLat - movedPoint.lat;
  const dLon = newLon - movedPoint.lon;

  context.accumulatedDelta.lat += dLat;
  context.accumulatedDelta.lon += dLon;

  const latlngs = getLatLngArrayForRing(route._display?.layer ?? null, ringIndex);

  for (const item of context.items) {
    const lat = item.lat0 + item.w * context.accumulatedDelta.lat;
    const lon = item.lon0 + item.w * context.accumulatedDelta.lon;
    points[item.idx].lat = lat;
    points[item.idx].lon = lon;

    if (latlngs?.[item.idx]) {
      latlngs[item.idx].lat = lat;
      latlngs[item.idx].lng = lon;
    }
  }

  route._display?.layer?.redraw();
}

/**
 * 更新航线的显示几何（简化版本）
 * 编辑模式下直接更新原始几何，不进行简化
 */
export function updateRouteDisplayGeometry(route: Route): void {
  if (!store.map) return;

  const display = ensureDisplay(route);

  if (route.editable) {
    display.simplified = route.points;
    display.holes = (route.holes ?? []).map((ring) => ring);
    updateRouteLayer(route);
    return;
  }

  if (getRouteGeometryType(route) === 'polygon') {
    display.simplified = simplifyClosedRing(route.points);
    display.holes = (route.holes ?? []).map((ring) => simplifyClosedRing(ring));
  } else {
    display.simplified = simplifyOpenPath(route.points);
    display.holes = [];
  }

  updateRouteLayer(route);
}

/**
 * 更新航线的 Leaflet 图层
 */
function updateRouteLayer(route: Route): void {
  if (!store.map) return;

  const display = ensureDisplay(route);
  const map = store.map;

  if (display.layer) {
    display.layer.remove();
  }

  display.markers.forEach((marker) => marker.remove());
  display.markers = [];

  const visibleOuter = display.simplified.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (visibleOuter.length === 0) return;

  const geometryType = getRouteGeometryType(route);
  let layer: L.Polyline | L.Polygon;

  if (geometryType === 'polygon' && visibleOuter.length >= 3) {
    const holes = (display.holes ?? [])
      .map((ring) => ring.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)))
      .filter((ring) => ring.length >= 3)
      .map((ring) => ring.map((point) => [point.lat, point.lon] as L.LatLngExpression));

    const outerLatLngs = visibleOuter.map((point) => [point.lat, point.lon] as L.LatLngExpression);
    const polygonLatLngs = holes.length > 0 ? [outerLatLngs, ...holes] : outerLatLngs;

    layer = L.polygon(polygonLatLngs as L.LatLngExpression[] | L.LatLngExpression[][], {
      color: route.color,
      weight: 3,
      opacity: 0.9,
      fillColor: route.color,
      fillOpacity: 0.2,
    }) as unknown as L.Polygon;
  } else {
    const latlngs = visibleOuter.map((point) => [point.lat, point.lon] as L.LatLngExpression);
    layer = L.polyline(latlngs, {
      color: route.color,
      weight: 3,
      opacity: 0.9,
    }) as unknown as L.Polyline;
  }

  if (route.heatEnabled && store.heatmap.hideRoute) {
    display.layer = layer;
  } else {
    display.layer = layer.addTo(map);
  }

  display.layer.on('click', (event: L.LeafletMouseEvent) => {
    event.originalEvent.stopPropagation();
    store.selectRoute(route.id);
    refreshRoutesList();

    if (route.editable && route.selected) {
      const nearest = findNearestPointSelection(event.latlng, route);
      if (nearest) {
        const point = getPointsForRing(route, nearest.ringIndex)[nearest.pointIdx];
        createDragMarker(route, nearest.pointIdx, L.latLng(point.lat, point.lon), nearest.ringIndex);
      }
    }

    updatePropertiesPanel();
  });
}

/**
 * 找到航线中距离给定位置最近的节点索引
 */
function findNearestPointSelection(latlng: L.LatLng, route: Route): RingSelection | null {
  const rings = [route.points, ...(route.holes ?? [])];
  const closed = isPolygonRoute(route);

  let nearestRingIndex = 0;
  let minRingDist = Infinity;

  rings.forEach((ring, ringIndex) => {
    if (ring.length < 2) return;

    const segmentCount = closed ? ring.length : ring.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const start = ring[i];
      const end = ring[closed ? (i + 1) % ring.length : i + 1];
      if (!start || !end) continue;

      const dist = distanceToSegment(latlng, start, end);
      if (dist < minRingDist) {
        minRingDist = dist;
        nearestRingIndex = ringIndex;
      }
    }
  });

  const ring = rings[nearestRingIndex];
  if (!ring || ring.length === 0) return null;

  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  let minPointDist = Infinity;
  let pointIdx = -1;

  for (let i = 0; i < ring.length; i++) {
    const point = ring[i];
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;

    const dist = haversineDistance(target, point);
    if (dist < minPointDist) {
      minPointDist = dist;
      pointIdx = i;
    }
  }

  return pointIdx >= 0 ? { ringIndex: nearestRingIndex, pointIdx } : null;
}

/**
 * 创建临时拖拽标记
 * 点击航线后创建，拖拽结束后移除
 */
function createDragMarker(route: Route, pointIdx: number, position: L.LatLng, ringIndex: number = 0): void {
  if (!store.map) return;

  if (dragMarker) {
    dragMarker.remove();
    dragMarker = null;
  }

  dragRouteId = route.id;
  dragPointIdx = pointIdx;
  dragRingIndex = ringIndex;

  dragMarker = L.marker(position, {
    draggable: true,
    icon: buildMarkerIcon(route.color, true),
  }).addTo(store.map);

  setRouteEditHandle(route, ringIndex, pointIdx, dragMarker);
  selectRoutePoint(route, ringIndex, pointIdx);
  updatePropertiesPanel();

  const statusEl = document.getElementById('status-selection');
  if (statusEl) {
    const ringLabel = isPolygonRoute(route) ? `（环 ${ringIndex + 1}）` : '';
    statusEl.textContent = `选中节点: ${pointIdx + 1}${ringLabel}`;
  }

  dragMarker.on('dragstart', () => {
    const ring = getPointsForRing(route, ringIndex);
    const point = ring[pointIdx];
    if (!point) return;

    store.dragContext = { startLat: point.lat, startLon: point.lon };
    smoothDragContext = buildSmoothDragContext(route, pointIdx, ringIndex);
  });

  dragMarker.on('drag', (event: L.LeafletEvent) => {
    const mouseEvent = event as unknown as L.LeafletMouseEvent;
    if (!smoothDragContext || !dragRouteId) return;

    smoothUpdatePoint(route, smoothDragContext, mouseEvent.latlng.lat, mouseEvent.latlng.lng);
    updatePropertiesPanel();
  });

  dragMarker.on('dragend', () => {
    store.dragContext = null;
    smoothDragContext = null;
    invalidateRouteDistanceCaches(route);

    if (dragMarker) {
      dragMarker.remove();
      dragMarker = null;
    }

    dragRouteId = null;
    dragPointIdx = -1;
    dragRingIndex = 0;
    store.clearEditHandle();

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
  dragRingIndex = 0;
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
export function addNodeToRoute(routeId: string, lat: number, lon: number, ringIndex: number = 0): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  const ring = getPointsForRing(route, ringIndex);
  ring.push({ lat, lon });
  invalidateRouteDistanceCaches(route);

  updateRouteDisplayGeometry(route);
  selectRoutePoint(route, ringIndex, ring.length - 1);

  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 在航线开头添加节点（绝对首点前插）
 */
export function prependNodeToRoute(routeId: string, lat: number, lon: number, ringIndex: number = 0): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  clearDragMarker();

  const ring = getPointsForRing(route, ringIndex);
  ring.unshift({ lat, lon });
  invalidateRouteDistanceCaches(route);

  updateRouteDisplayGeometry(route);
  selectRoutePoint(route, ringIndex, 0);

  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 选中航线端点并创建可拖拽编辑句柄
 */
export function selectRouteEndpoint(routeId: string, endpoint: 'start' | 'end'): boolean {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable || route.points.length === 0 || !store.map || isPolygonRoute(route)) {
    return false;
  }

  const pointIdx = endpoint === 'start' ? 0 : route.points.length - 1;
  const point = route.points[pointIdx];

  createDragMarker(route, pointIdx, L.latLng(point.lat, point.lon), 0);
  return true;
}

/**
 * 删除指定索引节点
 */
export function deleteNodeFromRoute(routeId: string, pointIdx: number, ringIndex: number = 0): boolean {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return false;

  const ring = getPointsForRing(route, ringIndex);
  if (pointIdx < 0 || pointIdx >= ring.length) return false;

  clearDragMarker();

  if (isPolygonRoute(route)) {
    if (ringIndex === 0 && ring.length <= 3) {
      return false;
    }

    if (ringIndex > 0 && ring.length <= 3) {
      route.holes?.splice(ringIndex - 1, 1);
    } else {
      ring.splice(pointIdx, 1);
    }
  } else {
    ring.splice(pointIdx, 1);
  }

  invalidateRouteDistanceCaches(route);

  const selected = store.selectedPoint;
  if (selected && selected.routeId === routeId) {
    const selectedRingIndex = selected.ringIndex ?? 0;

    if (ringIndex > 0 && ring.length <= 3) {
      if (selectedRingIndex === ringIndex) {
        store.selectedPoint = null;
      } else if (selectedRingIndex > ringIndex) {
        store.selectPoint(routeId, selected.pointIdx, selectedRingIndex - 1);
      }
    } else if (selectedRingIndex === ringIndex) {
      if (selected.pointIdx === pointIdx) {
        store.selectedPoint = null;
      } else if (selected.pointIdx > pointIdx) {
        selectRoutePoint(route, ringIndex, selected.pointIdx - 1);
      }
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
export function insertNodeAt(routeId: string, lat: number, lon: number, afterIdx: number, ringIndex: number = 0): void {
  const route = store.getRouteById(routeId);
  if (!route || !route.editable) return;

  const ring = getPointsForRing(route, ringIndex);
  ring.splice(afterIdx + 1, 0, { lat, lon });
  invalidateRouteDistanceCaches(route);

  updateRouteDisplayGeometry(route);
  selectRoutePoint(route, ringIndex, afterIdx + 1);

  refreshRoutesList();
  updatePropertiesPanel();
}

/**
 * 更新航线的累计距离缓存
 */
export function updateRouteDistanceCache(route: Route): void {
  route._distCache = buildDistanceCache(route.points, isPolygonRoute(route));
  route._holeDistCaches = (route.holes ?? []).map((ring) => buildDistanceCache(ring, true));
}

/**
 * 获取航线上两点之间的累计距离
 * @param route 航线
 * @param idx1 起点索引
 * @param idx2 终点索引
 * @returns 累计距离（米），如果索引无效返回 null
 */
export function getRouteCumulativeDistance(route: Route, idx1: number, idx2: number, ringIndex: number = 0): number | null {
  const points = getPointsForRing(route, ringIndex);
  if (idx1 < 0 || idx2 < 0 || idx1 >= points.length || idx2 >= points.length) {
    return null;
  }

  const cache = getDistanceCacheForRing(route, ringIndex);
  if (!cache) return null;

  const diff = Math.abs(cache[idx1] - cache[idx2]);
  if (!isPolygonRoute(route)) {
    return diff;
  }

  const perimeter = cache[points.length] ?? diff;
  return Math.min(diff, Math.max(0, perimeter - diff));
}

/**
 * 计算点到线段的最短距离（米）
 * 使用球面几何计算点到线段的距离
 */
function distanceToSegment(point: L.LatLng, a: Point, b: Point): number {
  if (a.lat === b.lat && a.lon === b.lon) {
    return haversineDistance({ lat: point.lat, lon: point.lng }, a);
  }

  const earthRadius = 6371000;
  const lat = point.lat * Math.PI / 180;
  const lng = point.lng * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lon1 = a.lon * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const lon2 = b.lon * Math.PI / 180;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const t = ((lng - lon1) * dLon + (lat - lat1) * dLat) / (dLon * dLon + dLat * dLat);
  const tClamped = Math.max(0, Math.min(1, t));

  const projLat = lat1 + tClamped * dLat;
  const projLng = lon1 + tClamped * dLon;
  const sinDLat = Math.sin((projLat - lat) / 2);
  const sinDLng = Math.sin((projLng - lng) / 2);
  const sinD = Math.sqrt(sinDLat * sinDLat + Math.cos(lat) * Math.cos(projLat) * sinDLng * sinDLng);

  return 2 * earthRadius * Math.asin(sinD);
}

/**
 * 找到距离点击位置最近的航线段索引
 * 返回段终点索引（即在该索引后插入）
 */
export function findNearestSegmentIndex(latlng: L.LatLng, route: Route, ringIndex: number = 0): number {
  const points = getPointsForRing(route, ringIndex);
  if (!store.map || points.length < 2) return -1;

  const closed = isPolygonRoute(route);
  const segmentCount = closed ? points.length : points.length - 1;

  let minDist = Infinity;
  let nearestIdx = -1;

  for (let i = 0; i < segmentCount; i++) {
    const start = points[i];
    const end = points[closed ? (i + 1) % points.length : i + 1];
    if (!start || !end) continue;

    const dist = distanceToSegment(latlng, start, end);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
    }
  }

  return nearestIdx;
}
