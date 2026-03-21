/**
 * 航线编辑器 - 应用入口
 * 基于 Leaflet + TypeScript + Vite
 */

import { createApp } from 'vue';

// Suppress mozPressure deprecation warning from Leaflet library
const originalWarn = console.warn;
console.warn = function (...args: unknown[]) {
  if (
    args[0] &&
    typeof args[0] === 'string' &&
    args[0].includes('mozPressure')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Import all modules
import App from './App.vue';
import './config/constants';
import './state/store';
import { initializeMap } from './map';
import { initializeUI } from './ui';
import './routes';
import './tools/measure';
import './tools/segment';
import './tools/heatmap';
import './import';
import './export';

// 初始化
(async () => {
  createApp(App).mount('#app');
  await initializeMap();
  initializeUI();
})();

console.log('航线编辑器 v2.1 (TypeScript版) 已加载');
