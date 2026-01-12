/**
 * 热力图工具模块
 * 支持为每条航线独立显示热力图
 */

import * as L from 'leaflet';
import { store, Route, HeatmapOptions } from '../state/store';
import { HEATMAP_CONFIG } from '../config/constants';

const gradients: Record<string, Record<number, string>> = {
  default: { 0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 0.9: 'red' },
  fire: { 0.2: 'yellow', 0.4: 'orange', 0.6: 'red', 0.8: 'darkred' },
  cold: { 0.2: 'blue', 0.4: 'cyan', 0.6: 'lime', 0.8: 'white' },
  grayscale: { 0: 'white', 1: 'black' }
};

// 缓存脚本加载状态
let heatScriptLoaded = false;
let heatLoadPromise: Promise<void> | null = null;

/**
 * 动态加载 leaflet.heat 脚本
 */
function loadHeatScript(): Promise<void> {
  if (heatScriptLoaded) {
    return Promise.resolve();
  }

  if (heatLoadPromise) {
    return heatLoadPromise;
  }

  heatLoadPromise = new Promise((resolve, reject) => {
    // 检查是否已经加载
    if ((window as unknown as { L?: { heatLayer?: unknown } }).L?.heatLayer) {
      heatScriptLoaded = true;
      heatLoadPromise = null;  // Clean up promise reference
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.onload = () => {
      heatScriptLoaded = true;
      heatLoadPromise = null;  // Clean up promise reference
      // 等待一小段时间确保 L 对象被更新
      setTimeout(() => {
        if ((window as unknown as { L?: { heatLayer?: unknown } }).L?.heatLayer) {
          resolve();
        } else {
          // 如果还是没找到，尝试等待 Leaflet 准备就绪
          const checkL = setInterval(() => {
            if ((window as unknown as { L?: { heatLayer?: unknown } }).L?.heatLayer) {
              clearInterval(checkL);
              resolve();
            }
          }, 50);
          // 5秒后超时
          setTimeout(() => {
            clearInterval(checkL);
            if ((window as unknown as { L?: { heatLayer?: unknown } }).L?.heatLayer) {
              resolve();
            } else {
              heatScriptLoaded = false;  // Reset on timeout
              reject(new Error('Leaflet.heat failed to load'));
            }
          }, 5000);
        }
      }, 100);
    };
    script.onerror = () => {
      heatScriptLoaded = false;  // Reset on error
      heatLoadPromise = null;
      reject(new Error('Failed to load leaflet.heat'));
    };
    document.head.appendChild(script);
  });

  return heatLoadPromise;
}

function getHeatData(route: Route): [number, number][] {
  return route.points.map(p => [p.lat, p.lon] as [number, number]);
}

function getDefaultHeatOptions(): HeatmapOptions {
  return {
    radius: HEATMAP_CONFIG.defaultRadius,
    blur: HEATMAP_CONFIG.defaultBlur,
    minOpacity: 0.1,
    gradient: 'default'
  };
}

function getGradient(gradientName: string): Record<number, string> {
  return gradients[gradientName] || gradients.default;
}

/**
 * 获取 heatLayer 函数
 */
async function getHeatLayerFn(): Promise<((points: [number, number][], options?: Record<string, unknown>) => L.Layer) | null> {
  try {
    await loadHeatScript();

    // 现在检查全局 L 对象
    const L_global = (window as unknown as { L?: { heatLayer?: (points: [number, number][], options: unknown) => L.Layer } }).L;
    const heatLayerFn = L_global?.heatLayer;

    if (typeof heatLayerFn === 'function') {
      return heatLayerFn;
    }

    console.warn('Leaflet.heat: heatLayer not found on L after loading');
    return null;
  } catch (e) {
    console.warn('Leaflet.heat plugin load failed', e);
    return null;
  }
}

export async function toggleRouteHeatLayer(routeId: string, enabled: boolean): Promise<void> {
  const route = store.getRouteById(routeId);
  if (!route) {
    console.warn('Route not found:', routeId);
    return;
  }

  // 获取 heatLayer 函数
  const heatLayerFn = await getHeatLayerFn();
  if (!heatLayerFn) {
    console.warn('Leaflet.heat plugin not available');
    setStatus('Heatmap plugin not loaded, please refresh');
    return;
  }

  // 确保 heatOptions 已初始化
  if (!route.heatOptions) {
    route.heatOptions = getDefaultHeatOptions();
  }

  route.heatEnabled = enabled;

  if (enabled) {
    // 移除旧的图层
    if (route.heatLayer && store.map) {
      store.map.removeLayer(route.heatLayer);
      route.heatLayer = null;
    }

    // 创建新的热力图层
    const heatData = getHeatData(route);
    if (heatData.length === 0) {
      setStatus('Route has no valid points');
      return;
    }

    const options = route.heatOptions;
    route.heatLayer = heatLayerFn(heatData, {
      radius: options.radius,
      blur: options.blur,
      minOpacity: options.minOpacity,
      gradient: getGradient(options.gradient),
      pane: 'overlayPane',
    });

    if (route.heatLayer && store.map) {
      route.heatLayer.addTo(store.map);

      // 根据设置隐藏或显示航线
      if (store.heatmap.hideRoute && route._display?.layer) {
        route._display.layer.remove();
      } else if (!store.heatmap.hideRoute && route.visible && route._display?.layer) {
        route._display.layer.addTo(store.map);
      }

      setStatus('Heatmap enabled for ' + route.name);
    } else if (!route.visible) {
      setStatus('Route ' + route.name + ' is hidden');
    }
  } else {
    if (route.heatLayer && store.map) {
      store.map.removeLayer(route.heatLayer);
      route.heatLayer = null;
    }
    // 恢复航线显示
    if (route.visible && route._display?.layer && store.map) {
      route._display.layer.addTo(store.map);
    }
    setStatus('Heatmap disabled for ' + route.name);
  }

  updateHeatmapUIState();
}

export function updateCurrentHeatOptions(options: Partial<HeatmapOptions>): void {
  const route = store.getSelectedRoute();
  if (!route || !route.heatEnabled || !route.heatLayer) return;

  if (route.heatOptions) {
    Object.assign(route.heatOptions, options);
  } else {
    route.heatOptions = { ...getDefaultHeatOptions(), ...options };
  }

  const layer = route.heatLayer as unknown as { setOptions(opts: unknown): void };
  if (typeof layer.setOptions === 'function' && route.heatOptions) {
    layer.setOptions({
      radius: route.heatOptions.radius,
      blur: route.heatOptions.blur,
      minOpacity: route.heatOptions.minOpacity,
      gradient: getGradient(route.heatOptions.gradient)
    });
  }
}

/**
 * 切换隐藏航线
 */
export function toggleHideRoute(hide: boolean): void {
  store.heatmap.hideRoute = hide;
  const route = store.getSelectedRoute();
  if (!route || !route.visible || !route._display?.layer || !store.map) return;

  // 只有在热力图已开启时才执行隐藏/显示操作
  if (!route.heatEnabled) return;

  if (hide) {
    route._display.layer.remove();
  } else {
    route._display.layer.addTo(store.map);
  }
}

export async function refreshAllHeatLayers(): Promise<void> {
  const heatLayerFn = await getHeatLayerFn();
  if (!heatLayerFn) return;

  for (const route of store.routes) {
    if (route.heatEnabled && route.heatLayer) {
      const heatData = getHeatData(route);
      const layer = route.heatLayer as unknown as { setLatLngs(latlngs: [number, number][]): void };
      if (typeof layer.setLatLngs === 'function') {
        layer.setLatLngs(heatData);
      }
    }
  }
}

export function syncHeatLayerVisibility(route: Route): void {
  if (!route) return;

  if (route.heatEnabled && route.heatLayer && store.map) {
    if (route.visible) {
      route.heatLayer.addTo(store.map);
    } else {
      store.map.removeLayer(route.heatLayer);
    }
  }
}

export function initRouteHeatOptions(route: Route): void {
  if (!route.heatOptions) {
    route.heatOptions = getDefaultHeatOptions();
  }
  route.heatEnabled = false;
  route.heatLayer = null;
}

export async function toggleHeatLayer(enabled: boolean): Promise<void> {
  const route = store.getSelectedRoute();
  if (route) {
    await toggleRouteHeatLayer(route.id, enabled);
  } else {
    setStatus('Please select a route first');
  }
}

export function updateHeatLayerOptions(): void {
  const route = store.getSelectedRoute();
  if (route && route.heatEnabled && route.heatLayer && route.heatOptions) {
    const layer = route.heatLayer as unknown as { setOptions(opts: unknown): void };
    if (typeof layer.setOptions === 'function') {
      layer.setOptions({
        radius: route.heatOptions.radius,
        blur: route.heatOptions.blur,
        minOpacity: route.heatOptions.minOpacity,
        gradient: getGradient(route.heatOptions.gradient)
      });
    }
  }
}

export function updateHeatmapUIState(): void {
  const route = store.getSelectedRoute();
  const enabledInput = document.getElementById('heatmap-enabled') as HTMLInputElement;
  const radiusInput = document.getElementById('heatmap-radius') as HTMLInputElement;
  const radiusValue = document.getElementById('heatmap-radius-value');
  const blurInput = document.getElementById('heatmap-blur') as HTMLInputElement;
  const blurValue = document.getElementById('heatmap-blur-value');
  const opacityInput = document.getElementById('heatmap-opacity') as HTMLInputElement;
  const opacityValue = document.getElementById('heatmap-opacity-value');

  if (!route) {
    if (enabledInput) {
      enabledInput.checked = false;
      enabledInput.disabled = true;
    }
    return;
  }

  if (enabledInput) {
    enabledInput.disabled = false;
    enabledInput.checked = route.heatEnabled || false;
  }

  if (route.heatOptions) {
    if (radiusInput) {
      radiusInput.value = route.heatOptions.radius.toString();
      if (radiusValue) radiusValue.textContent = route.heatOptions.radius.toString();
    }
    if (blurInput) {
      blurInput.value = route.heatOptions.blur.toString();
      if (blurValue) blurValue.textContent = route.heatOptions.blur.toString();
    }
    if (opacityInput) {
      opacityInput.value = (route.heatOptions.minOpacity * 100).toString();
      if (opacityValue) opacityValue.textContent = route.heatOptions.minOpacity.toFixed(2);
    }
  }
}

export function isAnyHeatEnabled(): boolean {
  return store.routes.some(r => r.heatEnabled);
}

function setStatus(message: string): void {
  const el = document.getElementById('status-selection');
  if (el) {
    el.textContent = message;
  }
}
