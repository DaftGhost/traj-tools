<script setup lang="ts">
import { computed } from 'vue';
import { deleteRoute, toggleRouteVisibility } from '../../routes';
import {
  getRouteVertexCount,
  isPolygonRoute,
  store,
  type Route,
} from '../../state/store';
import {
  refreshPropertiesView,
  refreshRouteListView,
  setRouteSearchQuery,
  uiViewState,
} from '../../ui/viewBridge';

const routeSearchQuery = computed({
  get: () => uiViewState.routeSearchQuery,
  set: (value: string) => setRouteSearchQuery(value),
});

const filteredRoutes = computed(() => {
  void uiViewState.routeListRevision;

  const searchQuery = uiViewState.routeSearchQuery.trim().toLowerCase();
  return store.routes.filter((route) =>
    route.name.toLowerCase().includes(searchQuery)
  );
});

const routeCount = computed(() => {
  void uiViewState.routeListRevision;
  return store.routes.length;
});

function getRouteSummary(route: Route): string {
  const vertexCount = getRouteVertexCount(route);
  if (!isPolygonRoute(route)) {
    return `${vertexCount} 点`;
  }

  const holeCount = route.holes?.length ?? 0;
  return holeCount > 0
    ? `${vertexCount} 点 · ${holeCount} 洞`
    : `${vertexCount} 点 · 多边形`;
}

function refreshSelectionViews(): void {
  refreshRouteListView();
  refreshPropertiesView();
}

function handleSelectRoute(routeId: string): void {
  store.selectRoute(routeId);
  refreshSelectionViews();
}

function handleToggleVisibility(routeId: string): void {
  toggleRouteVisibility(routeId);
  refreshSelectionViews();
}

function handleDeleteRoute(route: Route): void {
  if (!confirm(`确定要删除航线 "${route.name}" 吗？`)) {
    return;
  }

  deleteRoute(route.id);
  refreshSelectionViews();
}
</script>

<template>
  <div class="panel-view active" data-panel="files">
    <section class="panel-section">
      <div class="import-area">
        <label class="btn btn-primary">
          导入 CSV/GeoJSON/WKT
          <input
            id="file-input"
            type="file"
            accept=".csv,.geojson,.json,.wkt"
            multiple
          />
        </label>
      </div>
      <div class="base-map-selector">
        <label>底图选择</label>
        <select id="map-select">
          <option value="tdtVector">天地图矢量</option>
          <option value="tdtSatellite">天地图影像</option>
          <option value="tdtTerrain">天地图地形</option>
          <option value="osm">OpenStreetMap</option>
          <option value="satellite">Esri卫星</option>
          <option value="cartoDark">暗色地图</option>
          <option value="cartoLight">亮色地图</option>
        </select>
      </div>
    </section>

    <section class="panel-section panel-section-routes">
      <div class="panel-section-header">
        <span>航线列表</span>
        <span class="route-count">({{ routeCount }})</span>
      </div>
      <div class="routes-search">
        <input
          id="route-search"
          v-model="routeSearchQuery"
          type="text"
          placeholder="搜索航线..."
        />
      </div>
      <div class="routes-list" id="routes-list">
        <div
          v-for="route in filteredRoutes"
          :key="route.id"
          class="route-item"
          :class="{ selected: route.selected }"
          :data-id="route.id"
          @click="handleSelectRoute(route.id)"
        >
          <input
            class="route-checkbox"
            type="checkbox"
            :checked="route.visible"
            @click.stop
            @change="handleToggleVisibility(route.id)"
          />
          <span
            class="route-color"
            :style="{ backgroundColor: route.color }"
          ></span>
          <span class="route-name">{{ route.name }}</span>
          <span class="route-geometry-tag">{{
            isPolygonRoute(route) ? 'Polygon' : 'Line'
          }}</span>
          <span class="route-points">{{ getRouteSummary(route) }}</span>
          <button
            class="route-item-btn delete"
            title="删除航线"
            @click.stop="handleDeleteRoute(route)"
          >
            ×
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
