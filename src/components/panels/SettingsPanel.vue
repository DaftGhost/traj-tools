<template>
  <div class="panel-view" data-panel="settings">
    <section class="panel-section">
      <h3>外观</h3>
    </section>

    <section class="panel-section">
      <h3>地图</h3>
      <div class="setting-item">
        <label class="setting-checkbox">
          <input
            v-model="showOriginalRouteGeometry"
            type="checkbox"
            @change="handleShowOriginalRouteGeometryChange"
          />
          <span>非编辑模式显示原始几何</span>
        </label>
        <p class="hint">
          开启后，所有可见且未处于编辑模式的航线会使用原始点位渲染；关闭后恢复当前显示简化行为。
        </p>
      </div>
    </section>

    <section class="panel-section">
      <h3>关于</h3>
      <div class="about-info">
        <p>航线编辑器 v2.1</p>
        <p class="hint">基于 Leaflet + PapaParse + FileSaver</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { refreshAllRouteDisplayGeometry } from '../../routes/geometry';
import { store } from '../../state/store';

const showOriginalRouteGeometry = ref(false);

onMounted(() => {
  showOriginalRouteGeometry.value = store.uiState.showOriginalRouteGeometry;
});

function handleShowOriginalRouteGeometryChange(): void {
  store.uiState.showOriginalRouteGeometry = showOriginalRouteGeometry.value;
  refreshAllRouteDisplayGeometry();
}
</script>

<style scoped>
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.hint {
  margin: 0;
  color: #666;
  font-size: 12px;
  line-height: 1.4;
}
</style>
