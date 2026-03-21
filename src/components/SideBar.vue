<script setup lang="ts">
import EditPanel from './panels/EditPanel.vue';
import ExportPanel from './panels/ExportPanel.vue';
import FilesPanel from './panels/FilesPanel.vue';
import HeatmapPanel from './panels/HeatmapPanel.vue';
import HelpPanel from './panels/HelpPanel.vue';
import MeasurePanel from './panels/MeasurePanel.vue';
import SettingsPanel from './panels/SettingsPanel.vue';
</script>

<template>
  <aside class="side-bar" id="side-bar">
    <div class="side-bar-content">
      <FilesPanel />
      <EditPanel />
      <MeasurePanel />
      <HeatmapPanel />
      <ExportPanel />
      <SettingsPanel />
      <HelpPanel />
    </div>

    <div class="side-bar-resize-handle" id="side-bar-resize"></div>
  </aside>
</template>
