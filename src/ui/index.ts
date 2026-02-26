/**
 * UI 初始化模块
 */

import { store } from '../state/store';
import { initializePanelSwitching } from './panels';
import { initializeKeyboardShortcuts } from './keyboard';
import { initializeCommandPalette } from './commands';
import { getLastSelectedBaseLayer, switchBaseLayer } from '../map/layers';
import { fitAllRoutes } from '../map';
import { setUIRefreshFunctions } from '../routes/index';

/**
 * 初始化所有 UI 组件
 */
export function initializeUI(): void {
  initializePanelSwitching();
  initializeKeyboardShortcuts();
  initializeCommandPalette();
  initializePropertiesPanel();
  initializeMenuBar();
  initializeFileInput();
  initializeMapControls();
  initializeEditControls();
  initializeMeasureControls();
  initializeExportControls();
  initializeHeatmapControls();
  initializeSettings();
  initializeRouteList();
  updateStatusBar();

  // 初始化航线模块的 UI 函数引用（必须在 UI 函数定义后调用）
  setUIRefreshFunctions(updateRouteList, updatePropertiesPanel);
}

/**
 * 初始化属性面板
 */
function initializePropertiesPanel(): void {
  const toggleBtn = document.getElementById('properties-toggle');
  toggleBtn?.addEventListener('click', () => {
    import('./panels').then(m => m.togglePropertiesPanel());
  });
}

/**
 * 初始化菜单栏
 */
function initializeMenuBar(): void {
  document.querySelectorAll('.menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const menu = (e.currentTarget as HTMLElement).dataset.menu;
      handleMenuClick(menu || '');
    });
  });

  const cmdBtn = document.getElementById('cmd-palette-btn');
  cmdBtn?.addEventListener('click', () => {
    const overlay = document.getElementById('command-palette-overlay');
    overlay?.classList.toggle('visible');
    const input = document.getElementById('command-input') as HTMLInputElement;
    input?.focus();
  });
}

/**
 * 处理菜单点击
 */
function handleMenuClick(menu: string): void {
  switch (menu) {
    case 'file':
      handleFileMenu();
      break;
    case 'edit':
      handleEditMenu();
      break;
    case 'view':
      handleViewMenu();
      break;
    case 'help':
      handleHelpMenu();
      break;
  }
}

/**
 * 文件菜单
 */
function handleFileMenu(): void {
  // 简单实现：触发导入操作
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileInput?.click();
}

/**
 * 编辑菜单
 */
function handleEditMenu(): void {
  const route = store.getSelectedRoute();
  if (!route) {
    setStatus('请先选择一条航线');
    return;
  }

  if (!route.editable) {
    // 开启编辑模式
    toggleEditMode();
  }
}

/**
 * 视图菜单
 */
function handleViewMenu(): void {
  // 切换右侧属性面板
  import('./panels').then(m => m.togglePropertiesPanel());
}

/**
 * 帮助菜单
 */
function handleHelpMenu(): void {
  import('./panels').then(m => m.switchToPanel('help'));
}

/**
 * 设置状态栏消息
 */
function setStatus(message: string): void {
  const el = document.getElementById('status-selection');
  if (el) {
    el.textContent = message;
  }
}

/**
 * 初始化文件输入
 */
function initializeFileInput(): void {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileInput?.addEventListener('change', handleFiles);
}

/**
 * 处理文件选择
 */
async function handleFiles(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const { importRoute } = await import('../import/index');
      await importRoute(file);
    } catch (error) {
      console.error('导入文件失败:', file.name, error);
    }
  }

  target.value = '';
  updateRouteList();
  updateStatusBar();
}

/**
 * 初始化地图控件
 */
function initializeMapControls(): void {
  const mapSelect = document.getElementById('map-select') as unknown as HTMLSelectElement;

  // 设置上次选择的底图为初始值
  if (mapSelect) {
    const lastLayer = getLastSelectedBaseLayer();
    mapSelect.value = lastLayer;
  }

  mapSelect?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    switchBaseLayer(target.value);
  });

  const fitBoundsBtn = document.getElementById('fit-bounds');
  fitBoundsBtn?.addEventListener('click', fitAllRoutes);
}

/**
 * 初始化编辑控件
 */
function initializeEditControls(): void {
  const toggleEditBtn = document.getElementById('toggle-edit');
  toggleEditBtn?.addEventListener('click', toggleEditMode);

  const addNodeBtn = document.getElementById('add-node');
  addNodeBtn?.addEventListener('click', toggleAddNodeMode);

  const deleteNodeBtn = document.getElementById('delete-node');
  deleteNodeBtn?.addEventListener('click', deleteSelectedNode);

  const newRouteBtn = document.getElementById('new-route');
  newRouteBtn?.addEventListener('click', () => {
    import('../tools/draw').then(m => {
      if (m.isDrawingMode()) {
        m.finishDrawingRoute();
      } else {
        m.startDrawingRoute();
      }
    });
  });

  const mergeRoutesBtn = document.getElementById('merge-routes');
  mergeRoutesBtn?.addEventListener('click', openMergeDialog);

  initializeMergeDialog();
  initializeSmoothControls();
}

/**
 * 添加节点模式状态
 */
let addNodeMode = false;

/**
 * 切换添加节点模式
 */
function toggleAddNodeMode(): void {
  const route = store.getSelectedRoute();
  if (!route) {
    alert('请先选择一条航线');
    return;
  }
  if (!route.editable) {
    alert('请先开启编辑模式');
    return;
  }

  addNodeMode = !addNodeMode;

  const addNodeBtn = document.getElementById('add-node');
  if (addNodeBtn) {
    addNodeBtn.classList.toggle('btn-success', addNodeMode);
    addNodeBtn.textContent = addNodeMode ? '取消添加' : '添加节点';
  }

  // 如果开启添加节点模式，设置地图点击事件
  if (addNodeMode && store.map) {
    store.map.on('click', handleAddNodeClick);
  } else if (store.map) {
    store.map.off('click', handleAddNodeClick);
  }
}

/**
 * 处理地图点击（添加节点）
 */
function handleAddNodeClick(e: L.LeafletMouseEvent): void {
  if (!addNodeMode) return;

  const route = store.getSelectedRoute();
  if (!route) return;

  // 获取添加位置设置
  const positionInput = document.querySelector('input[name="add-node-position"]:checked') as HTMLInputElement;
  const position = positionInput?.value || 'end';

  import('../routes/geometry').then(m => {
    if (position === 'start') {
      // 在开头添加（索引 0 后插入，即成为新索引 1）
      m.insertNodeAt(route.id, e.latlng.lat, e.latlng.lng, 0);
    } else if (position === 'between') {
      // 在两节点之间添加 - 找到最近的段
      const nearestIdx = m.findNearestSegmentIndex(e.latlng, route);
      if (nearestIdx >= 0) {
        m.insertNodeAt(route.id, e.latlng.lat, e.latlng.lng, nearestIdx);
      } else {
        // 没找到合适的段，默认添加到末尾
        m.addNodeToRoute(route.id, e.latlng.lat, e.latlng.lng);
      }
    } else {
      // 默认在末尾添加
      m.addNodeToRoute(route.id, e.latlng.lat, e.latlng.lng);
    }
  });
}

/**
 * 初始化平滑半径控件
 */
function initializeSmoothControls(): void {
  const radiusInput = document.getElementById('smooth-radius') as HTMLInputElement;
  const radiusDisplay = document.getElementById('smooth-radius-km');

  // 初始化时同步值到 store
  if (radiusInput) {
    store.smoothRadius = parseInt(radiusInput.value) || 20;
    if (radiusDisplay) {
      radiusDisplay.textContent = (store.smoothRadius / 1000).toFixed(2) + ' km';
    }
  }

  radiusInput?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    store.smoothRadius = value;
    if (radiusDisplay) {
      radiusDisplay.textContent = (value / 1000).toFixed(2) + ' km';
    }
  });

  ['smooth-plus-1', 'smooth-plus-100', 'smooth-minus-1', 'smooth-minus-100'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      const input = document.getElementById('smooth-radius') as HTMLInputElement;
      if (input) {
        let value = parseInt(input.value) || 20;
        if (id.includes('plus')) {
          value += id.includes('100') ? 100 : 1;
        } else {
          value -= id.includes('100') ? 100 : 1;
        }
        value = Math.max(1, Math.min(10000, value));
        input.value = value.toString();
        store.smoothRadius = value;
        if (radiusDisplay) {
          radiusDisplay.textContent = (value / 1000).toFixed(2) + ' km';
        }
        input.dispatchEvent(new Event('input'));
      }
    });
  });
}

/**
 * 切换编辑模式
 */
function toggleEditMode(): void {
  const route = store.getSelectedRoute();
  if (!route) return;

  // 如果关闭编辑模式，清除选中状态和拖拽标记
  if (route.editable) {
    store.clearEditHandle();
    store.selectedPoint = null;
    // 清除 geometry 模块中的拖拽标记
    import('../routes/geometry').then(m => m.clearDragMarker());
  }

  route.editable = !route.editable;

  const btn = document.getElementById('toggle-edit');
  if (btn) {
    btn.textContent = route.editable ? '关闭编辑' : '开启编辑';
    btn.classList.toggle('btn-success', route.editable);
  }

  import('../routes/geometry').then(m => {
    if (route._display) {
      m.updateRouteDisplayGeometry(route);
    }
  });

  // 更新属性面板
  updatePropertiesPanel();
}

/**
 * 删除选中节点
 */
export function deleteSelectedNode(): void {
  if (!store.selectedPoint) return;

  const route = store.getRouteById(store.selectedPoint.routeId);
  if (!route || !route.editable) return;

  const idx = store.selectedPoint.pointIdx;
  route.points.splice(idx, 1);

  store.selectedPoint = null;
  store.clearEditHandle();

  import('../routes/geometry').then(m => m.updateRouteDisplayGeometry(route));
  updateRouteList();
  updatePropertiesPanel();
}

/**
 * 合并航线对话框状态
 */
let selectedMergeRouteId: string | null = null;

/**
 * 初始化合并对话框
 */
function initializeMergeDialog(): void {
  const overlay = document.getElementById('merge-dialog-overlay');
  const closeBtn = document.getElementById('merge-dialog-close');
  const cancelBtn = document.getElementById('merge-dialog-cancel');
  const confirmBtn = document.getElementById('merge-dialog-confirm');

  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeMergeDialog();
    }
  });

  closeBtn?.addEventListener('click', closeMergeDialog);
  cancelBtn?.addEventListener('click', closeMergeDialog);
  confirmBtn?.addEventListener('click', confirmMerge);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('visible')) {
      closeMergeDialog();
    }
  });
}

/**
 * 打开合并对话框
 */
function openMergeDialog(): void {
  const route = store.getSelectedRoute();
  if (!route) {
    alert('请先选择一条航线');
    return;
  }

  if (store.routes.length < 2) {
    alert('需要至少两条航线才能进行合并');
    return;
  }

  selectedMergeRouteId = null;
  renderMergeRouteList();

  const overlay = document.getElementById('merge-dialog-overlay');
  overlay?.classList.add('visible');
}

/**
 * 关闭合并对话框
 */
function closeMergeDialog(): void {
  const overlay = document.getElementById('merge-dialog-overlay');
  overlay?.classList.remove('visible');
  selectedMergeRouteId = null;
}

/**
 * 渲染合并航线列表
 */
function renderMergeRouteList(): void {
  const container = document.getElementById('merge-route-list');
  if (!container) return;

  const selectedRoute = store.getSelectedRoute();
  const otherRoutes = store.routes.filter(r => r.id !== selectedRoute?.id);

  container.innerHTML = '';

  if (otherRoutes.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'merge-route-empty';
    emptyEl.textContent = '没有其他航线可合并';
    container.appendChild(emptyEl);
    return;
  }

  otherRoutes.forEach(route => {
    const item = document.createElement('div');
    item.className = 'merge-route-item';
    item.dataset.id = route.id;

    const colorSpan = document.createElement('span');
    colorSpan.className = 'route-color';
    colorSpan.style.backgroundColor = route.color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'route-name';
    nameSpan.textContent = route.name;

    const pointsSpan = document.createElement('span');
    pointsSpan.className = 'route-points';
    pointsSpan.textContent = route.points.length + ' 点';

    item.appendChild(colorSpan);
    item.appendChild(nameSpan);
    item.appendChild(pointsSpan);

    item.addEventListener('click', () => {
      document.querySelectorAll('.merge-route-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectedMergeRouteId = route.id;
    });

    container.appendChild(item);
  });
}

/**
 * 确认合并
 */
function confirmMerge(): void {
  const route = store.getSelectedRoute();
  if (!route || !selectedMergeRouteId) {
    alert('请选择要合并的航线');
    return;
  }

  import('../routes/index').then(m => {
    const mergedRoute = m.mergeRoutes(route.id, selectedMergeRouteId!);
    if (mergedRoute) {
      closeMergeDialog();
      updateRouteList();
      updatePropertiesPanel();
    } else {
      alert('合并失败');
    }
  });
}

/**
 * 初始化测距控件
 */
function initializeMeasureControls(): void {
  const toggleBtn = document.getElementById('toggle-measure');
  const clearBtn = document.getElementById('clear-measure');

  toggleBtn?.addEventListener('click', () => {
    import('../tools/measure').then(m => m.toggleMeasureMode());
  });

  clearBtn?.addEventListener('click', () => {
    import('../tools/measure').then(m => m.clearMeasure());
  });
}

/**
 * 初始化导出控件
 */
function initializeExportControls(): void {
  const exportBtn = document.getElementById('export-btn');
  const segmentBtn = document.getElementById('export-segment');
  const toggleSegmentBtn = document.getElementById('toggle-segment-export');

  exportBtn?.addEventListener('click', () => {
    import('../export/index').then(m => m.exportData());
  });

  segmentBtn?.addEventListener('click', () => {
    import('../export/index').then(m => m.exportSegment());
  });

  toggleSegmentBtn?.addEventListener('click', () => {
    import('../tools/segment').then(m => m.toggleSegmentExportMode());
  });

  const radiusSlider = document.getElementById('segment-search-radius') as HTMLInputElement;
  const radiusValue = document.getElementById('segment-search-radius-value');
  radiusSlider?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (radiusValue) {
      radiusValue.textContent = value + 'm';
    }
    store.segmentExport.searchRadius = parseInt(value);
  });
}

/**
 * 初始化热力图控件
 */
function initializeHeatmapControls(): void {
  const enabledCheckbox = document.getElementById('heatmap-enabled') as HTMLInputElement;
  const radiusSlider = document.getElementById('heatmap-radius') as HTMLInputElement;
  const blurSlider = document.getElementById('heatmap-blur') as HTMLInputElement;
  const opacitySlider = document.getElementById('heatmap-opacity') as HTMLInputElement;
  const gradientSelect = document.getElementById('heatmap-gradient') as unknown as HTMLSelectElement;

  enabledCheckbox?.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    store.heatmap.enabled = enabled;
    import('../tools/heatmap').then(m => m.toggleHeatLayer(enabled));
  });

  radiusSlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    document.getElementById('heatmap-radius-value')!.textContent = value.toString();
    store.heatmap.options.radius = value;
    import('../tools/heatmap').then(m => m.updateCurrentHeatOptions({ radius: value }));
  });

  blurSlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    document.getElementById('heatmap-blur-value')!.textContent = value.toString();
    store.heatmap.options.blur = value;
    import('../tools/heatmap').then(m => m.updateCurrentHeatOptions({ blur: value }));
  });

  opacitySlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    document.getElementById('heatmap-opacity-value')!.textContent = (value / 100).toString();
    store.heatmap.options.opacity = value / 100;
    import('../tools/heatmap').then(m => m.updateCurrentHeatOptions({ minOpacity: value / 100 }));
  });

  gradientSelect?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value as 'default' | 'fire' | 'cold' | 'grayscale';
    store.heatmap.options.gradient = value;
    import('../tools/heatmap').then(m => m.updateCurrentHeatOptions({ gradient: value }));
  });

  // 隐藏航线复选框
  const hideRouteCheckbox = document.getElementById('heatmap-hide-route') as HTMLInputElement;
  hideRouteCheckbox?.addEventListener('change', (e) => {
    const hide = (e.target as HTMLInputElement).checked;
    import('../tools/heatmap').then(m => m.toggleHideRoute(hide));
  });
}

/**
 * 初始化设置
 */
function initializeSettings(): void {
  // 设置面板初始化
}

/**
 * 初始化航线列表
 */
function initializeRouteList(): void {
  const searchInput = document.getElementById('route-search') as HTMLInputElement;
  searchInput?.addEventListener('input', updateRouteList);
  updateRouteList();
}

/**
 * 更新航线列表显示
 */
export function updateRouteList(): void {
  const container = document.getElementById('routes-list');
  if (!container) return;

  const searchQuery = (document.getElementById('route-search') as HTMLInputElement)?.value?.toLowerCase() || '';
  const filteredRoutes = store.routes.filter(r => r.name.toLowerCase().includes(searchQuery));

  container.innerHTML = '';
  filteredRoutes.forEach(route => {
    const item = document.createElement('div');
    item.className = 'route-item' + (route.selected ? ' selected' : '');
    item.dataset.id = route.id;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'route-checkbox';
    checkbox.checked = route.visible;

    const colorSpan = document.createElement('span');
    colorSpan.className = 'route-color';
    colorSpan.style.backgroundColor = route.color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'route-name';
    nameSpan.textContent = route.name;

    const pointsSpan = document.createElement('span');
    pointsSpan.className = 'route-points';
    pointsSpan.textContent = route.points.length + ' 点';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'route-item-btn delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = '删除航线';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定要删除航线 "' + route.name + '" 吗？')) {
        import('../routes/index').then(m => {
          m.deleteRoute(route.id);
          updateRouteList();
          updatePropertiesPanel();
        });
      }
    });

    item.appendChild(checkbox);
    item.appendChild(colorSpan);
    item.appendChild(nameSpan);
    item.appendChild(pointsSpan);
    item.appendChild(deleteBtn);

    item.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('route-checkbox')) {
        const id = item.dataset.id;
        if (id) {
          store.selectRoute(id);
          updateRouteList();
          updatePropertiesPanel();
        }
      }
    });

    checkbox.addEventListener('change', () => {
      const id = item.dataset.id;
      if (id) {
        import('../routes/index').then(m => m.toggleRouteVisibility(id));
      }
    });

    container.appendChild(item);
  });

  const countEl = document.querySelector('.route-count');
  if (countEl) countEl.textContent = '(' + store.routes.length + ')';
}

/**
 * 更新属性面板
 */
export function updatePropertiesPanel(): void {
  const route = store.getSelectedRoute();
  const point = store.selectedPoint;

  const routeNameEl = document.getElementById('prop-route-name');
  const routePointsEl = document.getElementById('prop-route-points');
  const routeLengthEl = document.getElementById('prop-route-length');
  const routeStatusEl = document.getElementById('prop-route-status');

  if (route) {
    routeNameEl!.textContent = route.name;
    routePointsEl!.textContent = route.points.length.toString();
    routeLengthEl!.textContent = calculateTotalLength(route);
    routeStatusEl!.textContent = route.editable ? '可编辑' : '只读';
  } else {
    routeNameEl!.textContent = '-';
    routePointsEl!.textContent = '-';
    routeLengthEl!.textContent = '-';
    routeStatusEl!.textContent = '-';
  }

  const pointIndexEl = document.getElementById('prop-point-index');
  const pointLatEl = document.getElementById('prop-point-lat');
  const pointLonEl = document.getElementById('prop-point-lon');

  if (point) {
    const p = store.getRouteById(point.routeId)?.points[point.pointIdx];
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number') {
      pointIndexEl!.textContent = point.pointIdx.toString();
      pointLatEl!.textContent = p.lat.toFixed(6);
      pointLonEl!.textContent = p.lon.toFixed(6);
    } else {
      pointIndexEl!.textContent = point.pointIdx.toString();
      pointLatEl!.textContent = '-';
      pointLonEl!.textContent = '-';
    }
  } else {
    pointIndexEl!.textContent = '-';
    pointLatEl!.textContent = '-';
    pointLonEl!.textContent = '-';
  }
}

/**
 * 计算航线总长度
 */
function calculateTotalLength(route: { points: { lat: number; lon: number }[] }): string {
  if (route.points.length < 2) return '0 m';

  let total = 0;
  for (let i = 1; i < route.points.length; i++) {
    const p1 = route.points[i - 1];
    const p2 = route.points[i];
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }

  if (total < 1000) return total.toFixed(1) + ' m';
  return (total / 1000).toFixed(2) + ' km';
}

/**
 * 更新状态栏
 */
function updateStatusBar(): void {
  const routeCountEl = document.getElementById('status-route-count');
  const pointCountEl = document.getElementById('status-point-count');
  const selectionEl = document.getElementById('status-selection');

  if (routeCountEl) routeCountEl.textContent = store.routes.length + ' 航线';
  if (pointCountEl) pointCountEl.textContent = store.getTotalPoints() + ' 点';
  if (selectionEl) selectionEl.textContent = store.selectedRouteId ? '已选中' : '未选中';
}
