/**
 * 地图底图配置
 */

import { store } from '../state/store';
import * as L from 'leaflet';

// 底图配置
export const baseLayers: Record<string, L.Layer> = {};
export let tiandituAvailable = false;

// 检查天地图是否可用（通过健康检查端点）
async function checkTiandituAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/tianditu/health');
    if (response.ok) {
      const data: { available: boolean } = await response.json();
      return data.available === true;
    }
  } catch {
    // 网络错误或端点不存在
  }
  return false;
}

// 初始化底图配置
export function initializeBaseLayers(): Promise<void> {
  return checkTiandituAvailable().then((available) => {
    tiandituAvailable = available;

    // 天地图配置（通过代理）
    if (available) {
      // 矢量地图：底图 + 注记
      baseLayers.tdtVector = L.layerGroup([
        L.tileLayer('/api/tianditu/vec_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
        L.tileLayer('/api/tianditu/cva_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
      ]);

      // 影像地图：底图 + 注记
      baseLayers.tdtSatellite = L.layerGroup([
        L.tileLayer('/api/tianditu/img_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
        L.tileLayer('/api/tianditu/cia_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
      ]);

      // 地形地图：底图 + 注记
      baseLayers.tdtTerrain = L.layerGroup([
        L.tileLayer('/api/tianditu/ter_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
        L.tileLayer('/api/tianditu/cta_w/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 1,
          attribution: '© 天地图',
        }),
      ]);
    }

    // OpenStreetMap
    baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });

    // Esri 卫星图
    baseLayers.satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '© Esri',
      }
    );

    // CartoDB 暗色地图
    baseLayers.cartoDark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 20,
        attribution: '© CartoDB',
      }
    );

    // CartoDB 亮色地图
    baseLayers.cartoLight = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 20,
        attribution: '© CartoDB',
      }
    );
  });
}

/**
 * 切换底图并保存选择
 */
export function switchBaseLayer(layerName: string): void {
  const layer = baseLayers[layerName];
  if (layer && store.map) {
    layer.addTo(store.map);
    Object.values(baseLayers).forEach((l) => {
      if (l !== layer) {
        l.remove();
      }
    });
    // 保存选择到 localStorage
    localStorage.setItem('selectedBaseLayer', layerName);
  }
}

/**
 * 获取上次选择的底图名称
 */
export function getLastSelectedBaseLayer(): string {
  const saved = localStorage.getItem('selectedBaseLayer');
  // 如果保存的是天地图但天地图不可用，则回退到 OSM
  if (saved && (saved.startsWith('tdt') || saved === 'tdtVector') && !tiandituAvailable) {
    return 'osm';
  }
  return saved || 'osm';
}
