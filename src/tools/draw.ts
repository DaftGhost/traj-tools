/**
 * 手动绘制新航线模块
 */

import * as L from 'leaflet';
import { store, Point } from '../state/store';
import { updateRouteDisplayGeometry } from '../routes/geometry';
import { buildMarkerIcon } from '../utils/markerIcon';
import { setStatus, updateStatusCoords } from '../utils/uiStatus';

let drawingMode = false;
let drawingRouteId: string | null = null;

export function startDrawingRoute(): void {
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

  const now = new Date();
  const routeName = `航线_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
  const route = store.addRoute(routeName, []);

  route.editable = true;
  store.selectRoute(route.id);
  drawingRouteId = route.id;
  drawingMode = true;

  updateDrawingButton();

  bindDrawingEvents();

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });

  setStatus(`已创建新航线: ${routeName}，点击地图添加点，双击/回车结束绘制`);
}

export function finishDrawingRoute(): void {
  if (!drawingMode || !drawingRouteId) return;

  const route = store.getRouteById(drawingRouteId);
  if (!route) {
    setStatus('错误：找不到正在绘制的航线');
    cancelDrawingRoute();
    return;
  }

  const pointCount = route.points.length;

  if (pointCount === 0) {
    store.removeRoute(drawingRouteId);
    setStatus('已取消新建航线（未添加任何点）');
  } else {
    route.editable = false;
    store.clearEditHandle();
    updateRouteDisplayGeometry(route);
    setStatus(`已完成新航线: ${route.name}（${pointCount} 个点）`);
  }

  drawingRouteId = null;
  drawingMode = false;

  unbindDrawingEvents();
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
    if (route.points.length === 0) {
      store.removeRoute(drawingRouteId);
      setStatus('已取消新建航线');
    } else {
      route.editable = false;
      store.clearEditHandle();
      updateRouteDisplayGeometry(route);
      setStatus(`已取消绘制，保留航线: ${route.name}`);
    }
  }

  drawingRouteId = null;
  drawingMode = false;

  unbindDrawingEvents();
  updateDrawingButton();

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });
}

export function isDrawingMode(): boolean {
  return drawingMode;
}

export function getDrawingRouteId(): string | null {
  return drawingRouteId;
}

function updateDrawingButton(): void {
  const btn = document.getElementById('new-route');
  if (btn) {
    if (drawingMode) {
      btn.textContent = '结束绘制';
      btn.classList.add('btn-warning');
    } else {
      btn.textContent = '新建航线';
      btn.classList.remove('btn-warning');
    }
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

  route.points.push({ lat, lon: lng });

  updateRouteDisplayGeometry(route);

  if (route.points.length === 1) {
    if (route._display) {
      route._display.markers = createDrawingMarkers(route);
    }
  }

  store.selectPoint(route.id, route.points.length - 1);

  import('../ui/index').then(m => {
    m.updateRouteList();
    m.updatePropertiesPanel();
  });

  const pointNum = route.points.length;
  setStatus(`已添加第 ${pointNum} 个点，继续点击添加，双击/回车结束`);
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

function createDrawingMarkers(route: { id: string; points: Point[]; color: string }): L.Marker[] {
  if (!store.map) return [];

  const markers: L.Marker[] = [];

  route.points.forEach((point, idx) => {
    const marker = L.marker([point.lat, point.lon], {
      icon: buildMarkerIcon(route.color, false),
    }).addTo(store.map!);

    marker.on('click', () => {
      store.selectPoint(route.id, idx);
      import('../ui/index').then(m => m.updatePropertiesPanel());
    });

    markers.push(marker);
  });

  return markers;
}

// REMOVED: setStatus and updateStatusCoords functions - now imported from utils/uiStatus
