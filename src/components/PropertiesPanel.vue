<script setup lang="ts">
import { computed } from 'vue';
import {
  getPointsForRing,
  getRouteVertexCount,
  isPolygonRoute,
  store,
} from '../state/store';
import {
  calculateLineLength,
  calculatePolygonArea,
  calculateRingPerimeter,
} from '../utils/geo';
import { uiViewState } from '../ui/viewBridge';

const routeSummary = computed(() => {
  void uiViewState.propertiesRevision;

  const route = store.getSelectedRoute();
  if (!route) {
    return {
      name: '-',
      type: '-',
      points: '-',
      holes: '-',
      lengthLabel: '长度',
      length: '-',
      area: '-',
      status: '-',
    };
  }

  return {
    name: route.name,
    type: isPolygonRoute(route) ? '多边形' : '折线',
    points: String(getRouteVertexCount(route)),
    holes: isPolygonRoute(route) ? String(route.holes?.length ?? 0) : '-',
    lengthLabel: isPolygonRoute(route) ? '周长' : '长度',
    length: formatDistance(calculateRouteBoundaryLength(route)),
    area: isPolygonRoute(route)
      ? formatArea(calculatePolygonArea(route.points, route.holes ?? []))
      : '-',
    status: route.editable ? '可编辑' : '只读',
  };
});

const pointSummary = computed(() => {
  void uiViewState.propertiesRevision;

  const point = store.selectedPoint;
  if (!point) {
    return {
      index: '-',
      lat: '-',
      lon: '-',
    };
  }

  const selectedRoute = store.getRouteById(point.routeId);
  const selectedPoint = selectedRoute
    ? getPointsForRing(selectedRoute, point.ringIndex ?? 0)[point.pointIdx]
    : undefined;

  if (!selectedPoint) {
    return {
      index: point.pointIdx.toString(),
      lat: '-',
      lon: '-',
    };
  }

  return {
    index:
      point.ringIndex !== undefined
        ? `环 ${point.ringIndex + 1} / 点 ${point.pointIdx + 1}`
        : point.pointIdx.toString(),
    lat: selectedPoint.lat.toFixed(6),
    lon: selectedPoint.lon.toFixed(6),
  };
});

const showSelectionHint = computed(() => {
  void uiViewState.propertiesRevision;
  return !store.getSelectedRoute() && !store.selectedPoint;
});

function formatDistance(totalMeters: number): string {
  if (totalMeters < 1000) return `${totalMeters.toFixed(1)} m`;
  return `${(totalMeters / 1000).toFixed(2)} km`;
}

function formatArea(areaSqm: number): string {
  if (areaSqm < 1_000_000) return `${areaSqm.toFixed(0)} m²`;
  return `${(areaSqm / 1_000_000).toFixed(2)} km²`;
}

function calculateRouteBoundaryLength(route: {
  points: { lat: number; lon: number }[];
  holes?: { lat: number; lon: number }[][];
  geometryType?: string;
}): number {
  if (!isPolygonRoute(route as never)) {
    return calculateLineLength(route.points);
  }

  return (
    calculateRingPerimeter(route.points) +
    (route.holes ?? []).reduce(
      (sum, ring) => sum + calculateRingPerimeter(ring),
      0
    )
  );
}
</script>

<template>
  <aside class="properties-panel" id="properties-panel">
    <div class="properties-header">
      <span class="properties-title">属性</span>
      <button
        class="icon-btn properties-toggle"
        id="properties-toggle"
        title="收起 (Ctrl+Alt+P)"
      >
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path
            fill="currentColor"
            d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
          />
        </svg>
      </button>
    </div>
    <div class="properties-content">
      <div class="property-section" id="prop-selected-route">
        <h4>选中航线</h4>
        <div class="property-row">
          <label>名称</label>
          <span id="prop-route-name">{{ routeSummary.name }}</span>
        </div>
        <div class="property-row">
          <label>类型</label>
          <span id="prop-route-type">{{ routeSummary.type }}</span>
        </div>
        <div class="property-row">
          <label>点数</label>
          <span id="prop-route-points">{{ routeSummary.points }}</span>
        </div>
        <div class="property-row">
          <label>孔洞</label>
          <span id="prop-route-holes">{{ routeSummary.holes }}</span>
        </div>
        <div class="property-row">
          <label id="prop-route-length-label">{{
            routeSummary.lengthLabel
          }}</label>
          <span id="prop-route-length">{{ routeSummary.length }}</span>
        </div>
        <div class="property-row">
          <label>面积</label>
          <span id="prop-route-area">{{ routeSummary.area }}</span>
        </div>
        <div class="property-row">
          <label>状态</label>
          <span id="prop-route-status">{{ routeSummary.status }}</span>
        </div>
      </div>

      <div class="property-section" id="prop-selected-point">
        <h4>选中点</h4>
        <div class="property-row">
          <label>序号</label>
          <span id="prop-point-index">{{ pointSummary.index }}</span>
        </div>
        <div class="property-row">
          <label>纬度</label>
          <span id="prop-point-lat">{{ pointSummary.lat }}</span>
        </div>
        <div class="property-row">
          <label>经度</label>
          <span id="prop-point-lon">{{ pointSummary.lon }}</span>
        </div>
      </div>

      <div
        v-if="showSelectionHint"
        class="property-section"
        id="prop-selection-info"
      >
        <p class="hint">请在地图上选择航线或点以查看属性</p>
      </div>
    </div>
    <div class="properties-resize-handle" id="properties-resize"></div>
  </aside>
</template>
