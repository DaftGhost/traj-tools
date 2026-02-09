/**
 * 测距工具模块
 */

import * as L from 'leaflet';
import { store, Point } from '../state/store';
import { haversineDistance } from '../utils/geo';
import { distanceMeters, snapToRoutes } from '../utils/snap';
import type { SnapRef } from '../types/refs';
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
  ref: SnapRef | null;
}

// REMOVED: MeasureRef interface - now uses SnapRef from types/refs.ts
// REMOVED: SNAP_THRESHOLD_PX - now uses MEASURE_CONFIG.snapThresholdPx from config

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

// REMOVED: sqSegDist, getSnapGeometry, findNearestVertex, snapToRoutes
// Now imported from utils/snap.ts

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
function getAlongRouteDistanceMeters(ref1: SnapRef | null, ref2: SnapRef | null): { meters: number; routeName: string } | null {
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
