<script setup lang="ts">
import { computed } from 'vue';
import { store } from '../state/store';
import { uiViewState } from '../ui/viewBridge';

const routeCountText = computed(() => {
  void uiViewState.statusRevision;
  return `${store.routes.length} 航线`;
});

const pointCountText = computed(() => {
  void uiViewState.statusRevision;
  return `${store.getTotalPoints()} 点`;
});

const selectionText = computed(() => {
  void uiViewState.statusRevision;

  if (uiViewState.statusMessage !== null) {
    return uiViewState.statusMessage;
  }

  return store.selectedRouteId ? '已选中' : '未选中';
});
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar-left">
      <span class="status-item" id="status-route-count">{{
        routeCountText
      }}</span>
      <span class="status-item" id="status-point-count">{{
        pointCountText
      }}</span>
      <span class="status-item" id="status-selection">{{ selectionText }}</span>
    </div>
    <div class="status-bar-right">
      <span class="status-item" id="status-coords">{{
        uiViewState.coordsText
      }}</span>
      <span class="status-item" id="status-zoom">{{
        uiViewState.zoomText
      }}</span>
    </div>
  </footer>
</template>
