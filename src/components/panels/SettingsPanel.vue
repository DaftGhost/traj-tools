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
            v-model="localVectorZoomLock"
            type="checkbox"
            @change="handleLocalVectorZoomLockChange"
          />
          <span>锁定本地矢量 MBTiles 原始缩放级别</span>
        </label>
        <p class="hint">
          开启后，本地矢量 MBTiles
          会锁定在当前缩放级别，后续缩放只做过度缩放，不再切换原始瓦片级别。
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
import {
  isLocalVectorMbtilesZoomLockEnabled,
  setLocalVectorMbtilesZoomLockEnabled,
} from '../../map/layers';
import { store } from '../../state/store';

const localVectorZoomLock = ref(false);

onMounted(() => {
  const enabled = isLocalVectorMbtilesZoomLockEnabled();
  localVectorZoomLock.value = enabled;
  store.uiState.localVectorMbtilesZoomLockEnabled = enabled;
});

function handleLocalVectorZoomLockChange(): void {
  setLocalVectorMbtilesZoomLockEnabled(localVectorZoomLock.value);
  store.uiState.localVectorMbtilesZoomLockEnabled = localVectorZoomLock.value;
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
