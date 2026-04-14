import { reactive } from 'vue';
import { store } from '../state/store';

type RefreshEffect = () => void;

export const uiViewState = reactive({
  routeListRevision: 0,
  propertiesRevision: 0,
  statusRevision: 0,
  baseLayerRevision: 0,
  routeSearchQuery: store.uiState.routeSearchQuery,
  statusMessage: null as string | null,
  coordsText: '-- , --',
  zoomText: 'Zoom: --',
});

let routeListRefreshEffect: RefreshEffect = () => {};
let propertiesRefreshEffect: RefreshEffect = () => {};

export function registerViewRefreshCallbacks(callbacks: {
  onRouteListRefresh?: RefreshEffect;
  onPropertiesRefresh?: RefreshEffect;
}): void {
  routeListRefreshEffect = callbacks.onRouteListRefresh ?? (() => {});
  propertiesRefreshEffect = callbacks.onPropertiesRefresh ?? (() => {});
}

export function refreshRouteListView(): void {
  uiViewState.routeListRevision += 1;
  uiViewState.statusRevision += 1;
  routeListRefreshEffect();
}

export function refreshPropertiesView(): void {
  uiViewState.propertiesRevision += 1;
  uiViewState.statusRevision += 1;
  propertiesRefreshEffect();
}

export function refreshStatusSummary(): void {
  uiViewState.statusRevision += 1;
}

export function refreshBaseLayerView(): void {
  uiViewState.baseLayerRevision += 1;
}

export function setRouteSearchQuery(query: string): void {
  store.uiState.routeSearchQuery = query;
  uiViewState.routeSearchQuery = query;
}

export function setStatusMessage(message: string): void {
  uiViewState.statusMessage = message;
  uiViewState.statusRevision += 1;
}

export function clearStatusMessage(): void {
  uiViewState.statusMessage = null;
  uiViewState.statusRevision += 1;
}

export function updateStatusCoordsText(lat: number, lon: number): void {
  uiViewState.coordsText = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

export function updateStatusZoomText(zoom: number): void {
  uiViewState.zoomText = `Zoom: ${zoom}`;
}

export function resetViewBridgeStateForTests(): void {
  uiViewState.routeListRevision = 0;
  uiViewState.propertiesRevision = 0;
  uiViewState.statusRevision = 0;
  uiViewState.baseLayerRevision = 0;
  uiViewState.routeSearchQuery = '';
  uiViewState.statusMessage = null;
  uiViewState.coordsText = '-- , --';
  uiViewState.zoomText = 'Zoom: --';
  store.uiState.routeSearchQuery = '';
  routeListRefreshEffect = () => {};
  propertiesRefreshEffect = () => {};
}
