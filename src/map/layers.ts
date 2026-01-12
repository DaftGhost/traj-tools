/**
 * 地图底图配置
 */

import { store } from '../state/store';
import * as L from 'leaflet';

// 天地图 API Key（支持环境变量配置，Cloudflare Pages 设置环境变量 TIANDITU_API_KEY）
// 本地开发时可在 .env 文件中配置 VITE_TIANDITU_API_KEY
const tdtKey = import.meta.env?.VITE_TIANDITU_API_KEY || import.meta.env?.TIANDITU_API_KEY || '';

// 底图配置
export const baseLayers: Record<string, L.Layer> = {};

// 初始化底图配置
export function initializeBaseLayers(): void {
  // 天地图配置（需要 API Key）
  // 使用 HTTP 协议，子域名 t0-t7，TILEMATRIXSET=w

  if (tdtKey) {
    // 矢量地图：底图 + 注记
    baseLayers.tdtVector = L.layerGroup([
      L.tileLayer(`http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maxZoom: 18,
        minZoom: 1,
        attribution: '© 天地图',
      }),
      L.tileLayer(`http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maxZoom: 18,
        minZoom: 1,
        attribution: '© 天地图',
      }),
    ]);

    // 影像地图：底图 + 注记
    baseLayers.tdtSatellite = L.layerGroup([
      L.tileLayer(`http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maxZoom: 18,
        minZoom: 1,
        attribution: '© 天地图',
      }),
      L.tileLayer(`http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maxZoom: 18,
        minZoom: 1,
        attribution: '© 天地图',
      }),
    ]);

    // 地形地图：底图 + 注记
    baseLayers.tdtTerrain = L.layerGroup([
      L.tileLayer(`http://t0.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        maxZoom: 18,
        minZoom: 1,
        attribution: '© 天地图',
      }),
      L.tileLayer(`http://t0.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tdtKey}`, {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
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
  return localStorage.getItem('selectedBaseLayer') || 'tdtSatellite';
}
