/**
 * 面板切换模块
 */

import { store } from '../state/store';
import { invalidateMapSize } from '../map';

/**
 * 初始化面板切换
 */
export function initializePanelSwitching(): void {
  initializeSidebarResize();
  // Activity Bar 图标点击
  document.querySelectorAll('.activity-item').forEach((item) => {
    const el = item as HTMLElement;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = el.dataset.panel;
      if (panel === 'properties') {
        togglePropertiesPanel();
      } else {
        switchToPanel(panel as typeof store.uiState.activePanel);
      }
    });
  });

  // 可折叠子区域（平滑半径、片段截取）
  document.querySelectorAll('.panel-subsection-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      const content = header.nextElementSibling;
      header.classList.toggle('collapsed');
      content?.classList.toggle('collapsed');
    });
  });
}

/**
 * 切换侧边栏
 */
export function toggleSidebar(): void {
  const workbench = document.querySelector('.workbench');
  store.uiState.sideBarCollapsed = !store.uiState.sideBarCollapsed;
  workbench?.classList.toggle('sidebar-collapsed', store.uiState.sideBarCollapsed);

  // 侧边栏收起/展开后重新计算地图尺寸
  setTimeout(() => {
    invalidateMapSize();
  }, 300);
}

/**
 * 切换到指定面板
 */
export function switchToPanel(panelName: typeof store.uiState.activePanel): void {
  // 如果点击的是当前活动的面板，则折叠侧边栏
  if (store.uiState.activePanel === panelName) {
    toggleSidebar();
    return;
  }

  // 更新 Activity Bar 状态
  document.querySelectorAll('.activity-item').forEach((item) => {
    const el = item as HTMLElement;
    el.classList.toggle('active', el.dataset.panel === panelName);
  });

  // 更新面板内容显示
  document.querySelectorAll('.panel-view').forEach((view) => {
    const el = view as HTMLElement;
    el.classList.toggle('active', el.dataset.panel === panelName);
  });

  store.uiState.activePanel = panelName;
}

/**
 * 初始化属性面板
 */
export function initializePropertiesPanel(): void {
  const toggleBtn = document.getElementById('properties-toggle');
  toggleBtn?.addEventListener('click', togglePropertiesPanel);
}

/**
 * 切换属性面板
 */
export function togglePropertiesPanel(): void {
  const panel = document.getElementById('properties-panel');
  const workbench = document.querySelector('.workbench');
  store.uiState.propertiesPanelCollapsed = !store.uiState.propertiesPanelCollapsed;
  panel?.classList.toggle('visible', !store.uiState.propertiesPanelCollapsed);
  workbench?.classList.toggle('properties-visible', !store.uiState.propertiesPanelCollapsed);

  setTimeout(() => {
    invalidateMapSize();
  }, 300);
}

/**
 * 边栏宽度 resize 状态
 */
let isResizing = false;
let startX = 0;
let startWidth = 0;

/**
 * 初始化边栏宽度调节
 */
function initializeSidebarResize(): void {
  const handle = document.getElementById('side-bar-resize');
  if (!handle) return;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-bar-width'), 10) || 280;
    document.body.style.cursor = 'col-resize';
    handle.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const diff = e.clientX - startX;
    const minWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-bar-min-width'), 10) || 200;
    const maxWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side-bar-max-width'), 10) || 500;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + diff));
    document.documentElement.style.setProperty('--side-bar-width', `${newWidth}px`);
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      const handle = document.getElementById('side-bar-resize');
      if (handle) handle.style.cursor = 'col-resize';
      invalidateMapSize();
    }
  });
}
