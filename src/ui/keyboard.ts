/**
 * 键盘快捷键模块
 */

import { store } from '../state/store';
import { switchToPanel, toggleSidebar, togglePropertiesPanel } from './panels';
import { fitAllRoutes } from '../map';
import { toggleCommandPalette as uiToggleCommandPalette } from './commands';
import { updateRouteList, updatePropertiesPanel } from './index';
import { deleteSelectedNode } from './index';

/**
 * 初始化键盘快捷键
 */
export function initializeKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // 忽略输入框中的快捷键
    if (isInputElement(e.target)) {
      return;
    }

    // Ctrl+B - 切换侧边栏
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }

    // Ctrl+E - 编辑面板
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      switchToPanel('edit');
    }

    // Ctrl+M - 测距面板
    if (e.ctrlKey && e.key === 'm') {
      e.preventDefault();
      switchToPanel('measure');
    }

    // Ctrl+H - 热力图面板
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      switchToPanel('heatmap');
    }

    // Ctrl+X - 导出面板
    if (e.ctrlKey && e.key === 'x') {
      e.preventDefault();
      switchToPanel('export');
    }

    // Ctrl+, - 设置面板
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      switchToPanel('settings');
    }

    // Ctrl+Alt+P - 属性面板
    if (e.ctrlKey && e.altKey && e.key === 'p') {
      e.preventDefault();
      togglePropertiesPanel();
    }

    // Ctrl+Shift+P - 命令面板
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      uiToggleCommandPalette();
    }

    // Escape - 清除选择/关闭面板
    if (e.key === 'Escape') {
      handleEscape();
    }

    // Delete/Backspace - 删除选中节点
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.altKey) {
      if (store.selectedPoint && !isInputElement(e.target)) {
        e.preventDefault();
        deleteSelectedNode();
      }
    }

    // Ctrl+F - 聚焦所有航线
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      fitAllRoutes();
    }
  });
}

/**
 * 判断是否为输入元素
 */
function isInputElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

/**
 * 处理 Escape 键
 */
function handleEscape(): void {
  // 关闭命令面板
  const overlay = document.getElementById('command-palette-overlay');
  if (overlay?.classList.contains('visible')) {
    hideCommandPalette();
    return;
  }

  // 清除选择
  if (store.selectedPoint || store.selectedRouteId) {
    store.clearSelection();
    updateRouteList();
    updatePropertiesPanel();
  }
}

/**
 * 隐藏命令面板
 */
function hideCommandPalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-input') as HTMLInputElement;
  if (overlay) overlay.classList.remove('visible');
  if (input) input.value = '';
}
