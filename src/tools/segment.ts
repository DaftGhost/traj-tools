/**
 * 航段导出工具模块
 * 支持选择起点和终点，自动发现垂直范围内的航线片段
 */

import * as L from 'leaflet';
import {
  getPointsForRing,
  isPolygonRoute,
  store,
  supportsLinearSegments,
  type Point,
} from '../state/store';
import { pointsEqual } from '../utils/geo';
import {
  snapToRoutes,
  pointToSegmentDistance,
  getSnapGeometry,
} from '../utils/snap';
import type { SnapRef } from '../types/refs';
import { getRouteSegment } from '../routes/geometry';
import { setStatus } from '../utils/uiStatus';

let segmentExportMode = false;
let startPoint: SegmentPoint | null = null;
let endPoint: SegmentPoint | null = null;
let foundRoutes: string[] = [];
let hoverPoint: SegmentPoint | null = null;
let segmentLayer: L.LayerGroup | null = null;
let animationFrameId: number | null = null;

interface SegmentPoint {
  lat: number;
  lon: number;
  ref: SnapRef | null;
}

// REMOVED: SegmentRef interface - now uses SnapRef from types/refs.ts

function bindSegmentEvents(): void {
  if (!store.map) return;
  store.map.on('click', handleMapClick);
  store.map.on('mousemove', handleMapMouseMove);
  store.map.on('mouseout', handleMapMouseOut);
}

function unbindSegmentEvents(): void {
  if (!store.map) return;
  store.map.off('click', handleMapClick);
  store.map.off('mousemove', handleMapMouseMove);
  store.map.off('mouseout', handleMapMouseOut);
}

export function toggleSegmentExportMode(): void {
  if (segmentExportMode) {
    clearSegmentExport({ exit: true });
    return;
  }

  segmentExportMode = true;
  startPoint = null;
  endPoint = null;
  foundRoutes = [];
  hoverPoint = null;

  if (!segmentLayer) {
    segmentLayer = L.layerGroup().addTo(store.map!);
  } else {
    segmentLayer.addTo(store.map!);
  }

  // 绑定事件
  bindSegmentEvents();

  const btn = document.getElementById('toggle-segment-export');
  if (btn) {
    btn.textContent = '关闭片段截取';
    btn.classList.add('btn-active');
  }

  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

export function clearSegmentExport(
  { exit }: { exit: boolean } = { exit: false }
): void {
  startPoint = null;
  endPoint = null;
  foundRoutes = [];
  hoverPoint = null;

  if (segmentLayer) {
    segmentLayer.clearLayers();
  }

  if (exit) {
    segmentExportMode = false;
    // 解绑事件
    unbindSegmentEvents();
    if (segmentLayer && store.map?.hasLayer(segmentLayer)) {
      store.map.removeLayer(segmentLayer);
    }
  }

  const btn = document.getElementById('toggle-segment-export');
  if (btn) {
    btn.textContent = '开启片段截取';
    btn.classList.remove('btn-active');
  }

  updateSegmentButtons();
  updateSegmentStatus();
}

export function clearSegmentSelection(): void {
  if (!segmentExportMode) return;
  startPoint = null;
  endPoint = null;
  foundRoutes = [];
  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

function updateSegmentButtons(): void {
  const exportBtn = document.getElementById(
    'export-segment'
  ) as HTMLButtonElement;
  if (exportBtn) {
    exportBtn.disabled = !segmentExportMode || !startPoint || !endPoint;
  }
}

function updateSegmentStatus(): void {
  const statusEl = document.getElementById('segment-status');
  if (!statusEl) return;

  const lines: string[] = [];

  if (!segmentExportMode) {
    lines.push('未开启');
    statusEl.textContent = lines.join('\n');
    return;
  }

  if (!startPoint) {
    lines.push('点击地图选择起点（将吸附到最近的航线）');
  } else if (!endPoint) {
    lines.push('起点已选择');
    lines.push('点击地图选择终点（将吸附到最近的航线）');
  } else {
    lines.push('起点和终点已选择');
    lines.push('找到 ' + foundRoutes.length + ' 条航线');
    if (foundRoutes.length > 0) {
      const routeNames = foundRoutes
        .map((id) => store.getRouteById(id)?.name)
        .filter(Boolean)
        .join('、');
      lines.push('航线：' + routeNames);
    }
  }

  statusEl.textContent = lines.join('\n');
}

export function addSegmentPoint(latlng: L.LatLng): void {
  if (!segmentExportMode) return;

  const snapped = snapToRoutes(latlng, false, true);
  const point: SegmentPoint = {
    lat: snapped?.lat ?? latlng.lat,
    lon: snapped?.lon ?? latlng.lng,
    ref: snapped?.ref ?? null,
  };

  if (!startPoint) {
    startPoint = point;
    store.segmentExport.startPoint = { lat: point.lat, lon: point.lon }; // 同步到 store
    setStatus('起点已选择，请选择终点');
  } else if (!endPoint) {
    endPoint = point;
    store.segmentExport.endPoint = { lat: point.lat, lon: point.lon }; // 同步到 store
    findRoutesInPerpendicularRange();
    setStatus('终点已选择，已搜索到相关航线');
  } else {
    startPoint = point;
    endPoint = null;
    foundRoutes = [];
    store.segmentExport.startPoint = { lat: point.lat, lon: point.lon }; // 同步到 store
    store.segmentExport.endPoint = null;
    setStatus('起点已重新选择，请选择终点');
  }

  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

function updateSegmentHover(latlng: L.LatLng): void {
  if (!segmentExportMode) return;

  const snapped = snapToRoutes(latlng, false, true);
  hoverPoint = {
    lat: snapped?.lat ?? latlng.lat,
    lon: snapped?.lon ?? latlng.lng,
    ref: snapped?.ref ?? null,
  };

  scheduleRenderSegmentExport();
}

function scheduleRenderSegmentExport(): void {
  if (!segmentExportMode) return;
  if (animationFrameId) return;

  animationFrameId = requestAnimationFrame(() => {
    animationFrameId = null;
    renderSegmentExport();
  });
}

function renderSegmentExport(): void {
  if (!segmentExportMode || !segmentLayer) return;

  segmentLayer.clearLayers();

  const start = startPoint;
  const end = endPoint || hoverPoint;

  if (start) {
    L.circleMarker([start.lat, start.lon], {
      radius: 8,
      weight: 3,
      color: '#22c55e',
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindTooltip('起点', { permanent: true, direction: 'top' })
      .addTo(segmentLayer);
  }

  if (end) {
    const isHover = !endPoint;
    L.circleMarker([end.lat, end.lon], {
      radius: 8,
      weight: 3,
      color: isHover ? '#f59e0b' : '#ef4444',
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindTooltip(isHover ? '预览终点' : '终点', {
        permanent: true,
        direction: 'top',
      })
      .addTo(segmentLayer);
  }

  if (start && end) {
    L.polyline(
      [
        [start.lat, start.lon],
        [end.lat, end.lon],
      ],
      {
        color: '#7c3aed',
        weight: 2,
        opacity: 0.7,
        dashArray: endPoint ? '0' : '6 6',
      }
    ).addTo(segmentLayer);
  }

  if (start && start.ref) {
    drawPerpendicularSearchArea(start, store.segmentExport.searchRadius);
  }
  if (end && end.ref && endPoint) {
    drawPerpendicularSearchArea(end, store.segmentExport.searchRadius);
  }

  if (endPoint && foundRoutes.length > 0) {
    foundRoutes.forEach((routeId) => {
      const route = store.getRouteById(routeId);
      if (!route || !route.visible) return;
      const segment = extractRouteSegment(route, startPoint!, endPoint!);
      if (segment && segment.length > 0) {
        L.polyline(
          segment.map((p) => [p.lat, p.lon] as L.LatLngExpression),
          { color: '#f59e0b', weight: 4, opacity: 0.8 }
        ).addTo(segmentLayer!);
      }
    });
  }
}

function drawPerpendicularSearchArea(
  point: SegmentPoint,
  radius: number
): void {
  if (!point.ref || !store.map) return;

  const route = store.getRouteById(point.ref.routeId);
  if (!route) return;

  const ringIndex = point.ref.ringIndex ?? 0;
  const segment = getRouteSegment(route, point.ref.segIdx, ringIndex);
  if (!segment) return;

  const frac = point.ref.segFrac;

  const lat = segment.start.lat + (segment.end.lat - segment.start.lat) * frac;
  const lon = segment.start.lon + (segment.end.lon - segment.start.lon) * frac;

  L.circle([lat, lon], {
    radius,
    color: '#f59e0b',
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.1,
    dashArray: '5 5',
  }).addTo(segmentLayer!);
}

function findRoutesInPerpendicularRange(): void {
  if (!startPoint || !endPoint) {
    foundRoutes = [];
    return;
  }

  const found = new Set<string>();
  const radius = store.segmentExport.searchRadius;

  if (startPoint.ref) {
    found.add(startPoint.ref.routeId);
  }

  [startPoint, endPoint].forEach((point) => {
    if (!point.ref) return;

    const route = store.getRouteById(point.ref.routeId);
    if (!route) return;

    const ringIndex = point.ref.ringIndex ?? 0;
    const segment = getRouteSegment(route, point.ref.segIdx, ringIndex);
    if (!segment) return;

    const frac = point.ref.segFrac;

    const lat =
      segment.start.lat + (segment.end.lat - segment.start.lat) * frac;
    const lon =
      segment.start.lon + (segment.end.lon - segment.start.lon) * frac;

    for (const r of store.routes) {
      if (r.id === route.id) continue;
      if (!r.visible) continue;

      const segments = getSnapGeometry(r.id);
      for (const snapSegment of segments) {
        const dist = pointToSegmentDistance(
          lat,
          lon,
          snapSegment.start,
          snapSegment.end
        );
        if (dist <= radius) {
          found.add(r.id);
          break;
        }
      }
    }
  });

  foundRoutes = Array.from(found);

  // 自动选中第一条找到的航线
  if (foundRoutes.length > 0) {
    store.selectRoute(foundRoutes[0]);
  }

  updateSegmentStatus();
}

// REMOVED: pointToSegmentDistance - now imported from utils/snap.ts

function interpolateRefPoint(
  route: { points: Point[] },
  ref: SnapRef
): Point | null {
  const ringIndex = ref.ringIndex ?? 0;
  const segment = getRouteSegment(route as never, ref.segIdx, ringIndex);
  if (!segment) return null;

  return {
    lat:
      segment.start.lat + (segment.end.lat - segment.start.lat) * ref.segFrac,
    lon:
      segment.start.lon + (segment.end.lon - segment.start.lon) * ref.segFrac,
  };
}

function pushUniquePoint(points: Point[], point: Point): void {
  if (points.length === 0 || !pointsEqual(points[points.length - 1], point)) {
    points.push({ ...point });
  }
}

function extractOpenPathSegment(
  points: Point[],
  startRef: SnapRef,
  endRef: SnapRef
): Point[] {
  let startIdx = startRef.segIdx;
  let endIdx = endRef.segIdx;
  let startFrac = startRef.segFrac;
  let endFrac = endRef.segFrac;

  if (startIdx > endIdx || (startIdx === endIdx && startFrac > endFrac)) {
    [startIdx, endIdx] = [endIdx, startIdx];
    [startFrac, endFrac] = [endFrac, startFrac];
  }

  const segment: Point[] = [];
  const startPoint = {
    lat:
      points[startIdx].lat +
      (points[startIdx + 1].lat - points[startIdx].lat) * startFrac,
    lon:
      points[startIdx].lon +
      (points[startIdx + 1].lon - points[startIdx].lon) * startFrac,
  };
  pushUniquePoint(segment, startFrac > 0.001 ? startPoint : points[startIdx]);

  for (let i = startIdx + 1; i <= endIdx; i++) {
    if (i >= 0 && i < points.length) {
      pushUniquePoint(segment, points[i]);
    }
  }

  if (endFrac < 0.999 && endIdx + 1 < points.length) {
    pushUniquePoint(segment, {
      lat:
        points[endIdx].lat +
        (points[endIdx + 1].lat - points[endIdx].lat) * endFrac,
      lon:
        points[endIdx].lon +
        (points[endIdx + 1].lon - points[endIdx].lon) * endFrac,
    });
  }

  return segment;
}

function extractClosedRingArc(
  points: Point[],
  startRef: SnapRef,
  endRef: SnapRef
): Point[] {
  const segment: Point[] = [];
  const startPoint = {
    lat:
      points[startRef.segIdx].lat +
      (points[(startRef.segIdx + 1) % points.length].lat -
        points[startRef.segIdx].lat) *
        startRef.segFrac,
    lon:
      points[startRef.segIdx].lon +
      (points[(startRef.segIdx + 1) % points.length].lon -
        points[startRef.segIdx].lon) *
        startRef.segFrac,
  };
  pushUniquePoint(
    segment,
    startRef.segFrac > 0.001 ? startPoint : points[startRef.segIdx]
  );

  let segIdx = startRef.segIdx;
  while (segIdx !== endRef.segIdx) {
    const nextVertexIdx = (segIdx + 1) % points.length;
    pushUniquePoint(segment, points[nextVertexIdx]);
    segIdx = nextVertexIdx;
  }

  if (endRef.segFrac < 0.999) {
    pushUniquePoint(segment, {
      lat:
        points[endRef.segIdx].lat +
        (points[(endRef.segIdx + 1) % points.length].lat -
          points[endRef.segIdx].lat) *
          endRef.segFrac,
      lon:
        points[endRef.segIdx].lon +
        (points[(endRef.segIdx + 1) % points.length].lon -
          points[endRef.segIdx].lon) *
          endRef.segFrac,
    });
  } else {
    pushUniquePoint(segment, points[(endRef.segIdx + 1) % points.length]);
  }

  return segment;
}

export function extractRouteSegment(
  route: { id: string; points: Point[]; holes?: Point[][] },
  start: SegmentPoint,
  end: SegmentPoint
): Point[] | null {
  if (
    !route ||
    !route.points ||
    route.points.length < 2 ||
    !supportsLinearSegments(route as never)
  )
    return null;
  if (!start || !end) return null;

  if (
    start.ref?.routeId === route.id &&
    end.ref?.routeId === route.id &&
    (start.ref.ringIndex ?? 0) === (end.ref.ringIndex ?? 0)
  ) {
    const ringIndex = start.ref.ringIndex ?? 0;
    const ring = getPointsForRing(route as never, ringIndex);
    if (ring.length < 2) return null;

    if (isPolygonRoute(route as never)) {
      return extractClosedRingArc(ring, start.ref, end.ref);
    }

    return extractOpenPathSegment(ring, start.ref, end.ref);
  }

  if (start.ref?.routeId === route.id) {
    const ring = getPointsForRing(route as never, start.ref.ringIndex ?? 0);
    if (ring.length < 2 || isPolygonRoute(route as never)) return null;

    const segment: Point[] = [];
    const startPoint = interpolateRefPoint(route, start.ref);
    if (!startPoint) return null;

    pushUniquePoint(
      segment,
      start.ref.segFrac > 0.001 ? startPoint : ring[start.ref.segIdx]
    );
    for (let i = start.ref.segIdx + 1; i < ring.length; i++) {
      pushUniquePoint(segment, ring[i]);
    }

    return segment;
  }

  if (end.ref?.routeId === route.id) {
    const ring = getPointsForRing(route as never, end.ref.ringIndex ?? 0);
    if (ring.length < 2 || isPolygonRoute(route as never)) return null;

    const segment: Point[] = [];
    for (let i = 0; i <= end.ref.segIdx; i++) {
      pushUniquePoint(segment, ring[i]);
    }

    const endPoint = interpolateRefPoint(route, end.ref);
    if (endPoint && end.ref.segFrac < 0.999) {
      pushUniquePoint(segment, endPoint);
    }

    return segment;
  }

  return route.points.map((p) => ({ ...p }));
}

export function isSegmentExportMode(): boolean {
  return segmentExportMode;
}

export function handleMapClick(e: L.LeafletMouseEvent): void {
  addSegmentPoint(e.latlng);
}

export function handleMapMouseMove(e: L.LeafletMouseEvent): void {
  if (!segmentExportMode) return;
  updateSegmentHover(e.latlng);
}

export function handleMapMouseOut(): void {
  hoverPoint = null;
  renderSegmentExport();
}

// REMOVED: SnapResult, snapToRoutes, pointToSegmentDistance - now imported from utils/snap.ts
