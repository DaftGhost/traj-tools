<script setup lang="ts">
import CommandPalette from './CommandPalette.vue';
import MergeDialog from './MergeDialog.vue';
</script>

<template>
  <main class="editor-area">
    <div id="map" class="map-container"></div>
    <CommandPalette />
    <MergeDialog />
  </main>
</template>
