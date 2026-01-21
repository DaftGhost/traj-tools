/**
 * 航段导出工具模块
 * 支持选择起点和终点，自动发现垂直范围内的航线片段
 */

import * as L from 'leaflet';
import { store, Point } from '../state/store';
import { haversineDistance } from '../utils/geo';

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
  ref: SegmentRef | null;
}

interface SegmentRef {
  routeId: string;
  segIdx: number;
  segFrac: number;
}

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

export function clearSegmentExport({ exit }: { exit: boolean } = { exit: false }): void {
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
  const exportBtn = document.getElementById('export-segment') as HTMLButtonElement;
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
        .map(id => store.getRouteById(id)?.name)
        .filter(Boolean)
        .join('、');
      lines.push('航线：' + routeNames);
    }
  }

  statusEl.textContent = lines.join('\n');
}

export function addSegmentPoint(latlng: L.LatLng): void {
  if (!segmentExportMode) return;

  const snapped = snapToRoutes(latlng);
  const point: SegmentPoint = {
    lat: snapped?.lat ?? latlng.lat,
    lon: snapped?.lon ?? latlng.lng,
    ref: snapped?.ref ?? null
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

  const snapped = snapToRoutes(latlng);
  hoverPoint = {
    lat: snapped?.lat ?? latlng.lat,
    lon: snapped?.lon ?? latlng.lng,
    ref: snapped?.ref ?? null
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
      fillOpacity: 1
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
      fillOpacity: 1
    })
      .bindTooltip(isHover ? '预览终点' : '终点', { permanent: true, direction: 'top' })
      .addTo(segmentLayer);
  }

  if (start && end) {
    L.polyline(
      [[start.lat, start.lon], [end.lat, end.lon]],
      {
        color: '#7c3aed',
        weight: 2,
        opacity: 0.7,
        dashArray: endPoint ? '0' : '6 6'
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
          segment.map(p => [p.lat, p.lon] as L.LatLngExpression),
          { color: '#f59e0b', weight: 4, opacity: 0.8 }
        ).addTo(segmentLayer!);
      }
    });
  }
}

function drawPerpendicularSearchArea(point: SegmentPoint, radius: number): void {
  if (!point.ref || !store.map) return;

  const route = store.getRouteById(point.ref.routeId);
  if (!route || route.points.length < 2) return;

  const segIdx = point.ref.segIdx;
  if (segIdx < 0 || segIdx >= route.points.length - 1) return;

  const p1 = route.points[segIdx];
  const p2 = route.points[segIdx + 1];
  const frac = point.ref.segFrac;

  const lat = p1.lat + (p2.lat - p1.lat) * frac;
  const lon = p1.lon + (p2.lon - p1.lon) * frac;

  L.circle([lat, lon], {
    radius,
    color: '#f59e0b',
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.1,
    dashArray: '5 5'
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
    if (!route || route.points.length < 2) return;

    const segIdx = point.ref.segIdx;
    if (segIdx < 0 || segIdx >= route.points.length - 1) return;

    const p1 = route.points[segIdx];
    const p2 = route.points[segIdx + 1];
    const frac = point.ref.segFrac;

    const lat = p1.lat + (p2.lat - p1.lat) * frac;
    const lon = p1.lon + (p2.lon - p1.lon) * frac;

    for (const r of store.routes) {
      if (r.id === route.id) continue;
      if (!r.visible || r.points.length < 2) continue;

      for (let i = 0; i < r.points.length - 1; i++) {
        const segStart = r.points[i];
        const segEnd = r.points[i + 1];

        const dist = pointToSegmentDistance(lat, lon, segStart, segEnd);
        if (dist <= radius) {
          found.add(r.id);
          break;
        }

        const dist1 = store.map!.distance([lat, lon], [segStart.lat, segStart.lon]);
        const dist2 = store.map!.distance([lat, lon], [segEnd.lat, segEnd.lon]);
        if (dist1 <= radius || dist2 <= radius) {
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

function pointToSegmentDistance(lat: number, lon: number, segStart: Point, segEnd: Point): number {
  const dx = segEnd.lon - segStart.lon;
  const dy = segEnd.lat - segStart.lat;

  if (dx === 0 && dy === 0) {
    return haversineDistance({ lat, lon }, segStart);
  }

  const t = ((lon - segStart.lon) * dx + (lat - segStart.lat) * dy) / (dx * dx + dy * dy);

  if (t < 0) {
    return haversineDistance({ lat, lon }, segStart);
  } else if (t > 1) {
    return haversineDistance({ lat, lon }, segEnd);
  }

  const nearest = {
    lat: segStart.lat + t * dy,
    lon: segStart.lon + t * dx
  };

  return haversineDistance({ lat, lon }, nearest);
}

function extractRouteSegment(route: { id: string; points: Point[] }, start: SegmentPoint, end: SegmentPoint): Point[] | null {
  if (!route || !route.points || route.points.length < 2) return null;
  if (!start || !end) return null;

  if (start.ref?.routeId === route.id && end.ref?.routeId === route.id) {
    const startIdx = start.ref.segIdx;
    const endIdx = end.ref.segIdx;
    const startFrac = start.ref.segFrac;
    const endFrac = end.ref.segFrac;

    const segment: Point[] = [];

    if (startFrac > 0.001) {
      const p1 = route.points[startIdx];
      const p2 = route.points[startIdx + 1];
      segment.push({
        lat: p1.lat + (p2.lat - p1.lat) * startFrac,
        lon: p1.lon + (p2.lon - p1.lon) * startFrac
      });
    } else {
      segment.push({ ...route.points[startIdx] });
    }

    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    for (let i = minIdx + 1; i <= maxIdx; i++) {
      if (i > 0 && i < route.points.length) {
        segment.push({ ...route.points[i] });
      }
    }

    if (endFrac < 0.999) {
      const p1 = route.points[endIdx];
      const p2 = route.points[endIdx + 1];
      segment.push({
        lat: p1.lat + (p2.lat - p1.lat) * endFrac,
        lon: p1.lon + (p2.lon - p1.lon) * endFrac
      });
    } else {
      segment.push({ ...route.points[endIdx + 1] });
    }

    return segment;
  }

  if (start.ref?.routeId === route.id) {
    const startIdx = start.ref.segIdx;
    const startFrac = start.ref.segFrac;

    const segment: Point[] = [];

    if (startFrac > 0.001) {
      const p1 = route.points[startIdx];
      const p2 = route.points[startIdx + 1];
      segment.push({
        lat: p1.lat + (p2.lat - p1.lat) * startFrac,
        lon: p1.lon + (p2.lon - p1.lon) * startFrac
      });
    } else {
      segment.push({ ...route.points[startIdx] });
    }

    for (let i = startIdx + 1; i < route.points.length; i++) {
      segment.push({ ...route.points[i] });
    }

    return segment;
  }

  if (end.ref?.routeId === route.id) {
    const endIdx = end.ref.segIdx;
    const endFrac = end.ref.segFrac;

    const segment: Point[] = [];

    for (let i = 0; i <= endIdx; i++) {
      segment.push({ ...route.points[i] });
    }

    if (endFrac < 0.999 && endIdx + 1 < route.points.length) {
      const p1 = route.points[endIdx];
      const p2 = route.points[endIdx + 1];
      segment.push({
        lat: p1.lat + (p2.lat - p1.lat) * endFrac,
        lon: p1.lon + (p2.lon - p1.lon) * endFrac
      });
    }

    return segment;
  }

  return route.points.map(p => ({ ...p }));
}

export function exportRouteSegments(): void {
  if (!segmentExportMode || !startPoint || !endPoint) {
    setStatus('请先选择起点和终点');
    return;
  }

  if (foundRoutes.length === 0) {
    setStatus('没有找到可导出的航线片段');
    return;
  }

  const rows: Record<string, string | number>[] = [];

  foundRoutes.forEach((routeId) => {
    const route = store.getRouteById(routeId);
    if (!route || !route.visible) return;

    const points = extractRouteSegment(route, startPoint!, endPoint!);
    if (!points || points.length === 0) return;

    points.forEach((p, idx) => {
      rows.push({
        '航线名称': route.name,
        '序号': idx + 1,
        '纬度': Number(p.lat).toFixed(6),
        '经度': Number(p.lon).toFixed(6)
      });
    });
  });

  if (rows.length === 0) {
    setStatus('没有可导出的数据');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => row[h]).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', '航段_' + new Date().toISOString().slice(0, 10) + '.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setStatus('已导出 ' + rows.length + ' 个点到 CSV 文件');
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

interface SnapResult {
  lat: number;
  lon: number;
  ref: SegmentRef | null;
}

function snapToRoutes(latlng: L.LatLng): SnapResult | null {
  if (!store.map) return null;

  const target: Point = { lat: latlng.lat, lon: latlng.lng };

  let minDist = Infinity;
  let nearestVertex: { point: Point; routeId: string; index: number } | null = null;

  for (const route of store.routes.filter(r => r.visible)) {
    for (let i = 0; i < route.points.length; i++) {
      const p = route.points[i];
      const dist = haversineDistance(target, p);
      if (dist < minDist) {
        minDist = dist;
        nearestVertex = { point: p, routeId: route.id, index: i };
      }
    }
  }

  const mapZoom = store.map.getZoom();
  const metersPerPx = 156543.0332 * Math.cos(latlng.lat * Math.PI / 180) / Math.pow(2, mapZoom);
  const snapThresholdMeters = 12 * metersPerPx;

  if (nearestVertex && minDist < snapThresholdMeters) {
    return {
      lat: nearestVertex.point.lat,
      lon: nearestVertex.point.lon,
      ref: { routeId: nearestVertex.routeId, segIdx: nearestVertex.index, segFrac: 0 }
    };
  }

  return { lat: latlng.lat, lon: latlng.lng, ref: null };
}

function setStatus(message: string): void {
  const el = document.getElementById('status-selection');
  if (el) {
    el.textContent = message;
  }
}
