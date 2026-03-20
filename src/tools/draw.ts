/**
 * 手动绘制新航线模块
 */

import * as L from 'leaflet';
import { store, Point, GeometryType, getPointsForRing } from '../state/store';
import { updateRouteDisplayGeometry } from '../routes/geometry';
import { setStatus, updateStatusCoords } from '../utils/uiStatus';

let drawingMode = false;
let drawingRouteId: string | null = null;
let drawingGeometryType: GeometryType = 'polyline';
let drawingRingIndex = 0;
let previewCloseLine: L.Polyline | null = null;

function prepareDrawingSession(): void {
  if (store.dragContext) {
    store.dragContext = null;
  }

  // 使用动态导入代替 require，确保兼容浏览器 ES Modules
  import('./measure').then(m => {
    if (m.isMeasureActive()) {
      m.clearMeasure();
      m.toggleMeasureMode();
    }
  });

  if (store.segmentExport.active) {
    store.segmentExport.active = false;
    if (store.segmentExport.layer) {
      store.segmentExport.layer.clearLayers();
    }
  }
}

function clearPreviewCloseLine(): void {
  if (previewCloseLine) {
    previewCloseLine.remove();
    previewCloseLine = null;
  }
}

function updatePreviewCloseLine(route: { color: string; points: Point[] }): void {
  clearPreviewCloseLine();

  if (!store.map) return;
  const ring = route.points;
  if (ring.length < 2) return;

  const first = ring[0];
  const last = ring[ring.length - 1];
  previewCloseLine = L.polyline(
    [[last.lat, last.lon], [first.lat, first.lon]],
    {
      color: route.color,
      weight: 2,
      opacity: 0.7,
      dashArray: '6 6',
    }
  ).addTo(store.map);
}

function createRouteName(prefix: string): string {
  const now = new Date();
  return `${prefix}_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
}

function beginDrawingRoute(geometryType: GeometryType): void {
  prepareDrawingSession();

  const routeName = createRouteName(geometryType === 'polygon' ? '多边形' : '航线');
  const route = store.addRoute(routeName, [], { geometryType });

  route.editable = true;
  store.selectRoute(route.id);
  drawingRouteId = route.id;
  drawingMode = true;
  drawingGeometryType = geometryType;
  drawingRingIndex = 0;

  updateDrawingButton();
  bindDrawingEvents();

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });

  setStatus(
    geometryType === 'polygon'
      ? `已创建新多边形: ${routeName}，点击地图添加点，双击/回车结束绘制`
      : `已创建新航线: ${routeName}，点击地图添加点，双击/回车结束绘制`
  );
}

export function startDrawingRoute(): void {
  beginDrawingRoute('polyline');
}

export function startDrawingPolygon(): void {
  beginDrawingRoute('polygon');
}

export function startDrawingHole(routeId?: string): void {
  prepareDrawingSession();

  const route = routeId ? store.getRouteById(routeId) : store.getSelectedRoute();
  if (!route || route.geometryType !== 'polygon') {
    setStatus('请先选择一条多边形');
    return;
  }

  if (!route.editable) {
    setStatus('请先开启多边形编辑模式');
    return;
  }

  if (!route.holes) {
    route.holes = [];
  }

  route.holes.push([]);
  drawingMode = true;
  drawingRouteId = route.id;
  drawingGeometryType = 'polygon';
  drawingRingIndex = route.holes.length;

  updateDrawingButton();
  bindDrawingEvents();
  updateRouteDisplayGeometry(route);

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });

  setStatus(`开始为多边形 ${route.name} 绘制孔洞，点击地图添加点，双击/回车结束`);
}

export function finishDrawingRoute(): void {
  if (!drawingMode || !drawingRouteId) return;

  const route = store.getRouteById(drawingRouteId);
  if (!route) {
    setStatus('错误：找不到正在绘制的航线');
    cancelDrawingRoute();
    return;
  }

  const ring = getPointsForRing(route, drawingRingIndex);
  const pointCount = ring.length;
  const isHole = drawingRingIndex > 0;
  const minimumPoints = drawingGeometryType === 'polygon' ? 3 : 1;

  if (pointCount === 0) {
    if (isHole) {
      route.holes?.splice(drawingRingIndex - 1, 1);
      setStatus('已取消新建孔洞（未添加任何点）');
    } else {
      store.removeRoute(drawingRouteId);
      setStatus(drawingGeometryType === 'polygon' ? '已取消新建多边形（未添加任何点）' : '已取消新建航线（未添加任何点）');
    }
  } else if (pointCount < minimumPoints) {
    if (isHole) {
      route.holes?.splice(drawingRingIndex - 1, 1);
      setStatus('孔洞至少需要 3 个点，已取消当前孔洞');
    } else {
      store.removeRoute(drawingRouteId);
      setStatus(drawingGeometryType === 'polygon' ? '多边形至少需要 3 个点，已取消当前绘制' : '已取消新建航线');
    }
  } else {
    if (!isHole) {
      route.editable = false;
      store.clearEditHandle();
    }
    updateRouteDisplayGeometry(route);
    setStatus(
      isHole
        ? `已完成孔洞绘制: ${route.name}（${pointCount} 个点）`
        : drawingGeometryType === 'polygon'
          ? `已完成新多边形: ${route.name}（${pointCount} 个点）`
          : `已完成新航线: ${route.name}（${pointCount} 个点）`
    );
  }

  drawingRouteId = null;
  drawingMode = false;
  drawingRingIndex = 0;
  drawingGeometryType = 'polyline';

  unbindDrawingEvents();
  clearPreviewCloseLine();
  updateDrawingButton();

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });
}

export function cancelDrawingRoute(): void {
  if (!drawingMode || !drawingRouteId) return;

  const route = store.getRouteById(drawingRouteId);
  if (route) {
    const ring = getPointsForRing(route, drawingRingIndex);
    if (drawingRingIndex > 0) {
      route.holes?.splice(drawingRingIndex - 1, 1);
      updateRouteDisplayGeometry(route);
      setStatus(`已取消孔洞绘制: ${route.name}`);
    } else if (ring.length === 0) {
      store.removeRoute(drawingRouteId);
      setStatus(drawingGeometryType === 'polygon' ? '已取消新建多边形' : '已取消新建航线');
    } else {
      route.editable = false;
      store.clearEditHandle();
      updateRouteDisplayGeometry(route);
      setStatus(
        drawingGeometryType === 'polygon'
          ? `已取消绘制，保留多边形: ${route.name}`
          : `已取消绘制，保留航线: ${route.name}`
      );
    }
  }

  drawingRouteId = null;
  drawingMode = false;
  drawingRingIndex = 0;
  drawingGeometryType = 'polyline';

  unbindDrawingEvents();
  clearPreviewCloseLine();
  updateDrawingButton();

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });
}

export function isDrawingMode(): boolean {
  return drawingMode;
}

export function getDrawingModeKind(): 'polyline' | 'polygon' | 'hole' | null {
  if (!drawingMode) return null;
  if (drawingRingIndex > 0) return 'hole';
  return drawingGeometryType;
}

export function getDrawingRouteId(): string | null {
  return drawingRouteId;
}

function updateDrawingButton(): void {
  const routeBtn = document.getElementById('new-route') as HTMLButtonElement | null;
  const polygonBtn = document.getElementById('new-polygon') as HTMLButtonElement | null;
  const holeBtn = document.getElementById('add-hole') as HTMLButtonElement | null;
  const kind = getDrawingModeKind();

  if (routeBtn) {
    routeBtn.textContent = kind === 'polyline' ? '结束绘制' : '新建航线';
    routeBtn.classList.toggle('btn-warning', kind === 'polyline');
    routeBtn.disabled = Boolean(kind && kind !== 'polyline');
  }

  if (polygonBtn) {
    polygonBtn.textContent = kind === 'polygon' ? '完成多边形' : '新建多边形';
    polygonBtn.classList.toggle('btn-warning', kind === 'polygon');
    polygonBtn.disabled = Boolean(kind && kind !== 'polygon');
  }

  if (holeBtn) {
    holeBtn.textContent = kind === 'hole' ? '完成孔洞' : '添加孔洞';
    holeBtn.classList.toggle('btn-warning', kind === 'hole');
    holeBtn.disabled = Boolean(kind && kind !== 'hole');
  }
}

function bindDrawingEvents(): void {
  if (!store.map) return;

  store.map.on('click', handleDrawingClick);
  store.map.on('dblclick', handleDrawingDoubleClick);
  store.map.on('mousemove', handleDrawingMouseMove);
}

function unbindDrawingEvents(): void {
  if (!store.map) return;

  store.map.off('click', handleDrawingClick);
  store.map.off('dblclick', handleDrawingDoubleClick);
  store.map.off('mousemove', handleDrawingMouseMove);
}

function handleDrawingClick(e: L.LeafletMouseEvent): void {
  if (!drawingMode || !drawingRouteId) return;

  const route = store.getRouteById(drawingRouteId);
  if (!route || !route.editable) {
    setStatus('错误：无法找到正在绘制的航线');
    cancelDrawingRoute();
    return;
  }

  const { lat, lng } = e.latlng;
  const ring = getPointsForRing(route, drawingRingIndex);
  ring.push({ lat, lon: lng });

  updateRouteDisplayGeometry(route);
  if (drawingGeometryType === 'polygon') {
    updatePreviewCloseLine({ color: route.color, points: ring });
  }

  store.selectPoint(route.id, ring.length - 1, route.geometryType === 'polygon' ? drawingRingIndex : undefined);

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });

  const pointNum = ring.length;
  setStatus(
    drawingRingIndex > 0
      ? `已添加孔洞第 ${pointNum} 个点，继续点击添加，双击/回车结束`
      : drawingGeometryType === 'polygon'
        ? `已添加多边形第 ${pointNum} 个点，继续点击添加，双击/回车结束`
        : `已添加第 ${pointNum} 个点，继续点击添加，双击/回车结束`
  );
}

function handleDrawingDoubleClick(e: L.LeafletMouseEvent): void {
  if (!drawingMode) return;

  e.originalEvent.preventDefault();
  e.originalEvent.stopPropagation();

  finishDrawingRoute();
}

function handleDrawingMouseMove(e: L.LeafletMouseEvent): void {
  updateStatusCoords(e.latlng.lat, e.latlng.lng);
}

// REMOVED: setStatus and updateStatusCoords functions - now imported from utils/uiStatus
