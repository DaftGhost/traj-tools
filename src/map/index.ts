/**
 * 地图初始化模块
 */

import * as L from 'leaflet';
import { store } from '../state/store';
import { initializeBaseLayers, switchBaseLayer, baseLayers, getLastSelectedBaseLayer } from './layers';
import { refreshAllRouteDisplayGeometry } from '../routes/geometry';

// 修复 Leaflet 图标问题
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * 初始化地图
 */
export function initializeMap(): void {
  // 初始化底图
  initializeBaseLayers();

  // 创建地图实例
  store.map = L.map('map', {
    preferCanvas: true,
    center: [30, 110],
    zoom: 4,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: false,
  });

  // 添加上次选择的底图
  const lastLayerName = getLastSelectedBaseLayer();
  const lastLayer = baseLayers[lastLayerName] || baseLayers.tdtSatellite || baseLayers.osm;
  if (lastLayer) {
    lastLayer.addTo(store.map);
  }

  // 绑定地图事件
  bindMapEvents();

  // 设置地图控件位置
  L.control.zoom({ position: 'topright' }).addTo(store.map);
}

/**
 * 绑定地图事件
 */
function bindMapEvents(): void {
  if (!store.map) return;

  // 鼠标移动显示坐标
  store.map.on('mousemove', (e: L.LeafletMouseEvent) => {
    updateStatusCoords(e.latlng.lat, e.latlng.lng);
  });

  // 缩放级别变化
  store.map.on('zoomend', () => {
    if (store.map) {
      updateStatusZoom(store.map.getZoom());
      // 重新计算航线的简化显示
      refreshAllRouteDisplayGeometry();
    }
  });
}

/**
 * 更新状态栏坐标显示
 */
function updateStatusCoords(lat: number, lon: number): void {
  const el = document.getElementById('status-coords');
  if (el) {
    el.textContent = lat.toFixed(4) + ', ' + lon.toFixed(4);
  }
}

/**
 * 更新状态栏缩放级别显示
 */
function updateStatusZoom(zoom: number): void {
  const el = document.getElementById('status-zoom');
  if (el) {
    el.textContent = 'Zoom: ' + zoom;
  }
}

/**
 * 调整地图尺寸
 */
export function invalidateMapSize(): void {
  if (store.map) {
    store.map.invalidateSize();
  }
}

/**
 * 聚焦到所有航线
 */
export function fitAllRoutes(): void {
  if (!store.map || store.routes.length === 0) return;

  const bounds = L.latLngBounds(
    store.routes.flatMap((r) => r.points.map((p) => [p.lat, p.lon] as L.LatLngExpression))
  );
  store.map.fitBounds(bounds, { padding: [50, 50] });
}

/**
 * 聚焦到指定航线
 */
export function fitRoute(routeId: string): void {
  const route = store.getRouteById(routeId);
  if (!store.map || !route || route.points.length === 0) return;

  const bounds = L.latLngBounds(
    route.points.map((p) => [p.lat, p.lon] as L.LatLngExpression)
  );
  store.map.fitBounds(bounds, { padding: [50, 50] });
}
