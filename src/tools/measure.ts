/**
 * 测距工具模块
 */

import * as L from 'leaflet';
import { store, Point } from '../state/store';
import { haversineDistance } from '../utils/geo';
import { getRouteCumulativeDistance, updateRouteDistanceCache } from '../routes/geometry';

let measureMode = false;
let measurePoints: MeasurePoint[] = [];
let measureLine: L.Polyline | null = null;
let measureMarkers: L.CircleMarker[] = [];
let measureHover: MeasurePoint | null = null;
let measureLayer: L.LayerGroup | null = null;
let animationFrameId: number | null = null;

/** 测距点，包含吸附信息 */
interface MeasurePoint {
  lat: number;
  lon: number;
  ref: MeasureRef | null;
}

/** 测距点吸附到的航线引用 */
interface MeasureRef {
  routeId: string;
  segIdx: number;     // 段索引（起点在points数组中的索引）
  segFrac: number;    // 段内的位置（0-1，0表示在segIdx点，1表示在segIdx+1点）
}

// 测距配置
const SNAP_THRESHOLD_PX = 12;
const MIN_DISTANCE_METERS = 0.001;

function bindMeasureEvents(): void {
  if (!store.map) return;
  store.map.on('click', handleMapClick);
  store.map.on('mousemove', handleMapMouseMove);
  store.map.on('mouseout', handleMapMouseOut);
}

function unbindMeasureEvents(): void {
  if (!store.map) return;
  store.map.off('click', handleMapClick);
  store.map.off('mousemove', handleMapMouseMove);
  store.map.off('mouseout', handleMapMouseOut);
}

export function toggleMeasureMode(): void {
  measureMode = !measureMode;
  const btn = document.getElementById('toggle-measure');
  if (btn) {
    btn.classList.toggle('btn-active', measureMode);
    btn.textContent = measureMode ? '关闭测距' : '开启测距';
  }

  if (measureMode) {
    // 开启测距模式
    if (!measureLayer) {
      measureLayer = L.layerGroup().addTo(store.map!);
    } else {
      measureLayer.addTo(store.map!);
    }
    bindMeasureEvents();
  } else {
    // 关闭测距模式
    unbindMeasureEvents();
    clearMeasure();
    // 移除测距图层
    if (measureLayer) {
      measureLayer.remove();
      measureLayer = null;
    }
  }
}

export function isMeasureActive(): boolean {
  return measureMode;
}

export function clearMeasure(): void {
  measurePoints = [];
  if (measureLine) {
    store.map?.removeLayer(measureLine);
    measureLine = null;
  }
  measureMarkers.forEach(m => store.map?.removeLayer(m));
  measureMarkers = [];
  // 清除测距图层内容
  if (measureLayer) {
    measureLayer.clearLayers();
  }
  // 更新结果显示
  updateMeasureResult();
}

/**
 * 计算两点之间的球面距离（米）
 */
function distanceMeters(p1: Point, p2: Point): number {
  return haversineDistance(p1, p2);
}

/**
 * 计算点到线段的平方距离（度）
 */
function sqSegDist(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    return (point.lon - lineStart.lon) ** 2 + (point.lat - lineStart.lat) ** 2;
  }

  const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) /
    (dx * dx + dy * dy);

  if (t < 0) {
    return (point.lon - lineStart.lon) ** 2 + (point.lat - lineStart.lat) ** 2;
  } else if (t > 1) {
    return (point.lon - lineEnd.lon) ** 2 + (point.lat - lineEnd.lat) ** 2;
  }

  const nearest = {
    lon: lineStart.lon + t * dx,
    lat: lineStart.lat + t * dy
  };

  return (point.lon - nearest.lon) ** 2 + (point.lat - nearest.lat) ** 2;
}

/**
 * 获取用于吸附的航线几何
 */
function getSnapGeometry(routeId?: string): Array<{ start: Point; end: Point; routeId: string }> {
  const routes = routeId
    ? [store.getRouteById(routeId)].filter((r): r is NonNullable<typeof r> => r != null && r.visible)
    : store.routes.filter(r => r.visible);

  const segments: Array<{ start: Point; end: Point; routeId: string }> = [];

  for (const route of routes) {
    // 编辑模式下使用原始几何，否则使用简化几何
    const points = route.editable ? route.points : route._display?.simplified || route.points;

    for (let i = 0; i < points.length - 1; i++) {
      if (points[i] && points[i + 1]) {
        segments.push({
          start: points[i],
          end: points[i + 1],
          routeId: route.id
        });
      }
    }
  }

  return segments;
}

/**
 * 查找最近的航线节点
 */
function findNearestVertex(latlng: L.LatLng): { point: Point; routeId: string; index: number } | null {
  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  let minDist = Infinity;
  let result: { point: Point; routeId: string; index: number } | null = null;

  for (const route of store.routes.filter(r => r.visible)) {
    for (let i = 0; i < route.points.length; i++) {
      const p = route.points[i];
      const dist = haversineDistance(target, p);
      if (dist < minDist) {
        minDist = dist;
        result = { point: p, routeId: route.id, index: i };
      }
    }
  }

  return result;
}

/**
 * 吸附结果类型
 */
interface SnapResult {
  lat: number;
  lon: number;
  ref: MeasureRef | null;
}

/**
 * 吸附到最近的航线点或线段
 */
export function snapToRoutes(latlng: L.LatLng, snapSelectedOnly: boolean = false): SnapResult | null {
  if (!store.map) return null;

  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  const snapGeometry = getSnapGeometry(snapSelectedOnly ? store.selectedRouteId || undefined : undefined);

  if (snapGeometry.length === 0) return null;

  // 1. 首先查找最近的节点
  const nearestVertex = findNearestVertex(latlng);

  // 2. 查找最近的线段
  let minSegDist = Infinity;
  let nearestSegment: { start: Point; end: Point; routeId: string } | null = null;
  let nearestPointOnSegment: Point | null = null;
  let segIdx = -1;

  for (let i = 0; i < snapGeometry.length; i++) {
    const seg = snapGeometry[i];
    const dist = sqSegDist(target, seg.start, seg.end);
    if (dist < minSegDist) {
      minSegDist = dist;
      nearestSegment = seg;
      segIdx = i;

      // 计算最近点
      const dx = seg.end.lon - seg.start.lon;
      const dy = seg.end.lat - seg.start.lat;
      const t = ((target.lon - seg.start.lon) * dx + (target.lat - seg.start.lat) * dy) /
        (dx * dx + dy * dy);
      nearestPointOnSegment = {
        lon: seg.start.lon + t * dx,
        lat: seg.start.lat + t * dy
      };
    }
  }

  // 判断是否应该吸附
  // 转换为像素阈值进行比较
  const mapZoom = store.map.getZoom();
  const metersPerPx = 156543.0332 * Math.cos(latlng.lat * Math.PI / 180) / Math.pow(2, mapZoom);
  const snapThresholdMeters = SNAP_THRESHOLD_PX * metersPerPx;

  // 优先检查节点
  if (nearestVertex) {
    const vertexDist = haversineDistance(target, nearestVertex.point);
    if (vertexDist < snapThresholdMeters) {
      return {
        lat: nearestVertex.point.lat,
        lon: nearestVertex.point.lon,
        ref: { routeId: nearestVertex.routeId, segIdx: nearestVertex.index, segFrac: 0 }
      };
    }
  }

  // 检查线段
  if (nearestSegment && nearestPointOnSegment) {
    const distToSegment = distanceMeters(target, nearestPointOnSegment);
    if (distToSegment < snapThresholdMeters) {
      // 计算 segFrac
      const dx = nearestSegment.end.lon - nearestSegment.start.lon;
      const dy = nearestSegment.end.lat - nearestSegment.start.lat;
      const t = dx !== 0 || dy !== 0
        ? ((nearestPointOnSegment.lon - nearestSegment.start.lon) * dx + (nearestPointOnSegment.lat - nearestSegment.start.lat) * dy) /
          (dx * dx + dy * dy)
        : 0;

      return {
        lat: nearestPointOnSegment.lat,
        lon: nearestPointOnSegment.lon,
        ref: { routeId: nearestSegment.routeId, segIdx, segFrac: Math.max(0, Math.min(1, t)) }
      };
    }
  }

  return null;
}

export function addMeasurePoint(latlng: L.LatLng): void {
  if (!measureMode) return;

  const snapEnabled = (document.getElementById('measure-snap-enabled') as HTMLInputElement)?.checked;
  const snapSelectedOnly = (document.getElementById('measure-snap-selected-only') as HTMLInputElement)?.checked;

  let point: MeasurePoint = { lat: latlng.lat, lon: latlng.lng, ref: null };

  if (snapEnabled) {
    const snapped = snapToRoutes(latlng, snapSelectedOnly);
    if (snapped) {
      point = { lat: snapped.lat, lon: snapped.lon, ref: snapped.ref };
    }
  }

  measurePoints.push(point);

  // 渲染测距
  renderMeasure();
}

export function handleMapClick(e: L.LeafletMouseEvent): void {
  addMeasurePoint(e.latlng);
}

export function handleMapMouseMove(e: L.LeafletMouseEvent): void {
  if (!measureMode || measurePoints.length === 0) return;
  updateMeasureHover(e.latlng);
}

export function handleMapMouseOut(): void {
  measureHover = null;
  renderMeasure();
}

/**
 * 更新 hover 位置的测距预览
 */
function updateMeasureHover(latlng: L.LatLng): void {
  if (!measureMode || measurePoints.length === 0) {
    measureHover = null;
    return;
  }

  const snapEnabled = (document.getElementById('measure-snap-enabled') as HTMLInputElement)?.checked;
  const snapSelectedOnly = (document.getElementById('measure-snap-selected-only') as HTMLInputElement)?.checked;

  let hoverPoint: MeasurePoint = { lat: latlng.lat, lon: latlng.lng, ref: null };

  if (snapEnabled) {
    const preferRouteId = snapSelectedOnly ? store.selectedRouteId || undefined : undefined;
    const snapped = snapToRoutes(latlng, snapSelectedOnly);
    if (snapped) {
      hoverPoint = { lat: snapped.lat, lon: snapped.lon, ref: snapped.ref };
    }
  }

  measureHover = hoverPoint;
  renderMeasure();
}

/**
 * 获取两点之间的沿线距离
 */
function getAlongRouteDistanceMeters(ref1: MeasureRef | null, ref2: MeasureRef | null): { meters: number; routeName: string } | null {
  if (!ref1 || !ref2 || ref1.routeId !== ref2.routeId) {
    return null;
  }

  const route = store.getRouteById(ref1.routeId);
  if (!route || route.points.length < 2) {
    return null;
  }

  const idx1 = Math.min(ref1.segIdx, ref2.segIdx);
  const idx2 = Math.max(ref1.segIdx, ref2.segIdx);

  if (idx1 < 0 || idx2 >= route.points.length) {
    return null;
  }

  // 确保有距离缓存
  if (!route._distCache) {
    updateRouteDistanceCache(route);
    if (!route._distCache) {
      return null;
    }
  }

  const dist = Math.abs(route._distCache[idx1] - route._distCache[idx2]);
  return { meters: dist, routeName: route.name };
}

/**
 * 渲染测距
 */
function renderMeasure(): void {
  if (!measureMode || !measureLayer) return;

  measureLayer.clearLayers();

  const fixed = measurePoints.map(p => L.latLng(p.lat, p.lon));
  const hover = measureHover ? L.latLng(measureHover.lat, measureHover.lon) : null;

  // 绘制固定点 marker
  fixed.forEach((ll) => {
    L.circleMarker(ll, {
      radius: 5,
      fillColor: '#7c3aed',
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    }).addTo(measureLayer!);
  });

  // 绘制固定折线
  if (fixed.length >= 2) {
    L.polyline(fixed, { color: '#7c3aed', weight: 3, opacity: 0.95 }).addTo(measureLayer!);

    // 每段的距离标签
    for (let i = 0; i < fixed.length - 1; i++) {
      const a = measurePoints[i];
      const b = measurePoints[i + 1];
      const straight = distanceMeters(a, b);
      const along = getAlongRouteDistanceMeters(a.ref, b.ref);

      const mid = L.latLng((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
      const content = along
        ? `直线 ${formatMeters(straight)}\n沿线 ${formatMeters(along.meters)}`
        : `直线 ${formatMeters(straight)}`;

      L.tooltip({ permanent: true, direction: 'center', opacity: 0.9 })
        .setLatLng(mid)
        .setContent(content)
        .addTo(measureLayer!);
    }
  }

  // hover 预览线
  if (hover && fixed.length >= 1) {
    const last = measurePoints[measurePoints.length - 1];
    const a = last;
    const b = measureHover!;
    const straight = distanceMeters(a, b);
    const along = getAlongRouteDistanceMeters(a.ref, b.ref);
    const previewTotal = computeTotalMeters() + straight;

    L.polyline([fixed[fixed.length - 1], hover], {
      color: '#7c3aed',
      weight: 2,
      opacity: 0.6,
      dashArray: '6 6'
    }).addTo(measureLayer!);

    const mid = L.latLng((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
    const content = along
      ? `预览：直线 ${formatMeters(straight)} / 沿线 ${formatMeters(along.meters)}\n预计总长 ${formatMeters(previewTotal)}`
      : `预览：直线 ${formatMeters(straight)}\n预计总长 ${formatMeters(previewTotal)}`;

    L.tooltip({ permanent: true, direction: 'top', opacity: 0.9 })
      .setLatLng(mid)
      .setContent(content)
      .addTo(measureLayer!);
  }

  updateMeasureResult();
}

/**
 * 计算测距点序列的总长度
 */
function computeTotalMeters(): number {
  let total = 0;
  for (let i = 1; i < measurePoints.length; i++) {
    total += haversineDistance(
      { lat: measurePoints[i - 1].lat, lon: measurePoints[i - 1].lon },
      { lat: measurePoints[i].lat, lon: measurePoints[i].lon }
    );
  }
  return total;
}

/**
 * 格式化距离显示
 */
function formatMeters(meters: number): string {
  if (meters < 1000) {
    return meters.toFixed(1) + ' m';
  }
  return (meters / 1000).toFixed(2) + ' km';
}

/**
 * 更新测距结果面板显示
 */
function updateMeasureResult(): void {
  const resultEl = document.getElementById('measure-result');
  if (!resultEl) return;

  if (measurePoints.length === 0) {
    resultEl.textContent = '点击地图开始测距';
    return;
  }

  const total = computeTotalMeters();
  resultEl.textContent = `总距离: ${formatMeters(total)} (${measurePoints.length} 点)`;
}
