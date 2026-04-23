/**
 * 地图底图配置
 */

import { store } from '../state/store';
import * as L from 'leaflet';
import { VectorGridProtobuf } from 'leaflet.vectorgrid';
import type {
  MbtilesCatalogResponse,
  MbtilesCatalogSource,
} from '../mbtiles/shared';
import { buildVectorLayerStyles } from './vectorStyle';
import type { NormalizedVectorLayer } from '../mbtiles/vector-metadata';

const vectorGridCreate = VectorGridProtobuf as (
  url: string,
  options?: Record<string, unknown>
) => Promise<L.Layer>;

// 底图配置
export const baseLayers: Record<string, L.Layer> = {};
export let tiandituAvailable = false;

export type BaseLayerOption = {
  value: string;
  label: string;
  sourceType?: 'raster' | 'vector';
};

const builtInBaseLayerOptions: BaseLayerOption[] = [
  { value: 'osm', label: 'OpenStreetMap' },
  { value: 'satellite', label: 'Esri卫星' },
  { value: 'cartoDark', label: '暗色地图' },
  { value: 'cartoLight', label: '亮色地图' },
];

let localMbtilesSources: MbtilesCatalogSource[] = [];

function clearBaseLayers(): void {
  Object.keys(baseLayers).forEach((key) => {
    delete baseLayers[key];
  });
}

function getTiandituBaseLayerOptions(): BaseLayerOption[] {
  if (!tiandituAvailable) {
    return [];
  }

  return [
    { value: 'tdtVector', label: '天地图矢量' },
    { value: 'tdtSatellite', label: '天地图影像' },
    { value: 'tdtTerrain', label: '天地图地形' },
  ];
}

function getLocalMbtilesBaseLayerOptions(): BaseLayerOption[] {
  return localMbtilesSources.map((source) => ({
    value: `mbtiles:${source.id}`,
    label: `本地 MBTiles · ${source.label}`,
    sourceType: source.sourceType,
  }));
}

function toLayerBounds(
  bounds: MbtilesCatalogSource['bounds']
): L.LatLngBoundsExpression | undefined {
  if (!bounds) {
    return undefined;
  }

  const [minLon, minLat, maxLon, maxLat] = bounds;
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ];
}

async function fetchMbtilesCatalog(): Promise<MbtilesCatalogSource[]> {
  try {
    const response = await fetch('/api/mbtiles/catalog');
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as MbtilesCatalogResponse;
    if (!Array.isArray(data.sources)) {
      return [];
    }

    return data.sources;
  } catch {
    return [];
  }
}

async function registerLocalMbtilesLayers(
  sources: MbtilesCatalogSource[]
): Promise<void> {
  localMbtilesSources = sources;

  for (const source of sources) {
    const key = `mbtiles:${source.id}`;
    const url = `/api/mbtiles/${encodeURIComponent(source.id)}/{z}/{x}/{y}`;

    if (source.sourceType === 'vector' && source.vectorLayers) {
      const normalizedLayers: NormalizedVectorLayer[] = source.vectorLayers.map(
        (vl) => ({
          id: vl.id,
          description: vl.description,
          minZoom: vl.minZoom,
          maxZoom: vl.maxZoom,
        })
      );
      const styles = buildVectorLayerStyles(normalizedLayers);

      baseLayers[key] = (await vectorGridCreate(url, {
        minZoom: source.minZoom,
        maxNativeZoom: source.maxZoom,
        maxZoom: 18,
        attribution: source.attribution,
        bounds: toLayerBounds(source.bounds),
        vectorTileLayerStyles: styles,
        interactive: false,
      })) as unknown as L.Layer;
    } else {
      baseLayers[key] = L.tileLayer(url, {
        minZoom: source.minZoom,
        maxZoom: source.maxZoom,
        maxNativeZoom: source.maxZoom,
        attribution: source.attribution,
        bounds: toLayerBounds(source.bounds),
      });
    }
  }
}

export function getBaseLayerOptions(): BaseLayerOption[] {
  return [
    ...getTiandituBaseLayerOptions(),
    ...builtInBaseLayerOptions,
    ...getLocalMbtilesBaseLayerOptions(),
  ];
}

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
export async function initializeBaseLayers(): Promise<void> {
  clearBaseLayers();
  localMbtilesSources = [];

  tiandituAvailable = await checkTiandituAvailable();

  // 天地图配置（通过代理）
  if (tiandituAvailable) {
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
  baseLayers.osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }
  );

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

  await registerLocalMbtilesLayers(await fetchMbtilesCatalog());
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
  if (
    saved &&
    (saved.startsWith('tdt') || saved === 'tdtVector') &&
    !tiandituAvailable
  ) {
    return 'osm';
  }
  if (saved && !baseLayers[saved]) {
    return 'osm';
  }
  return saved || 'osm';
}

export function resetBaseLayerStateForTests(): void {
  clearBaseLayers();
  tiandituAvailable = false;
  localMbtilesSources = [];
}
