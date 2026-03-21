<script setup lang="ts">
import ActivityBar from './components/ActivityBar.vue';
import EditorArea from './components/EditorArea.vue';
import MenuBar from './components/MenuBar.vue';
import PropertiesPanel from './components/PropertiesPanel.vue';
import SideBar from './components/SideBar.vue';
import StatusBar from './components/StatusBar.vue';
</script>

<template>
  <div class="app-container">
    <MenuBar />

    <div class="workbench">
      <ActivityBar />
      <SideBar />
      <EditorArea />
      <PropertiesPanel />
    </div>

    <StatusBar />
  </div>
</template>
