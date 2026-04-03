/**
 * UI 初始化模块
 */

import { store, getPointsForRing, isPolygonRoute } from '../state/store';
import { initializePanelSwitching } from './panels';
import { initializeKeyboardShortcuts } from './keyboard';
import { initializeCommandPalette } from './commands';
import { getLastSelectedBaseLayer, switchBaseLayer } from '../map/layers';
import { fitAllRoutes } from '../map';
import { setUIRefreshFunctions } from '../routes/index';
import { setStatus } from '../utils/uiStatus';
import {
  clearStatusMessage,
  refreshPropertiesView,
  refreshRouteListView,
  refreshStatusSummary,
  registerViewRefreshCallbacks,
  setRouteSearchQuery,
} from './viewBridge';

registerViewRefreshCallbacks({
  onRouteListRefresh: updateExportBidirectionalControlState,
  onPropertiesRefresh: () => {
    syncEndpointQuickControls();
    updateExportBidirectionalControlState();
  },
});

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
    import('./panels').then((m) => m.togglePropertiesPanel());
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
  import('./panels').then((m) => m.togglePropertiesPanel());
}

/**
 * 帮助菜单
 */
function handleHelpMenu(): void {
  import('./panels').then((m) => m.switchToPanel('help'));
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
  const mapSelect = document.getElementById(
    'map-select'
  ) as unknown as HTMLSelectElement;

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

type EndpointQuickControlRefs = {
  controls: HTMLElement;
  startBtn: HTMLButtonElement;
  endBtn: HTMLButtonElement;
};

let endpointQuickControlRefs: EndpointQuickControlRefs | null = null;

function getEndpointQuickControlRefs(): EndpointQuickControlRefs | null {
  if (endpointQuickControlRefs) return endpointQuickControlRefs;

  const controls = document.getElementById('endpoint-quick-controls');
  const startBtn = document.getElementById(
    'select-start-endpoint'
  ) as HTMLButtonElement | null;
  const endBtn = document.getElementById(
    'select-end-endpoint'
  ) as HTMLButtonElement | null;

  if (!controls || !startBtn || !endBtn) return null;

  endpointQuickControlRefs = { controls, startBtn, endBtn };
  return endpointQuickControlRefs;
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

  const endpointRefs = getEndpointQuickControlRefs();
  endpointRefs?.startBtn.addEventListener('click', () =>
    selectEndpointQuickly('start')
  );
  endpointRefs?.endBtn.addEventListener('click', () =>
    selectEndpointQuickly('end')
  );

  const newRouteBtn = document.getElementById('new-route');
  newRouteBtn?.addEventListener('click', () => {
    import('../tools/draw').then((m) => {
      if (m.getDrawingModeKind?.() === 'polyline') {
        m.finishDrawingRoute();
      } else if (!m.isDrawingMode()) {
        m.startDrawingRoute();
      }
    });
  });

  const newPolygonBtn = document.getElementById('new-polygon');
  newPolygonBtn?.addEventListener('click', () => {
    import('../tools/draw').then((m) => {
      if (m.getDrawingModeKind?.() === 'polygon') {
        m.finishDrawingRoute();
      } else if (!m.isDrawingMode()) {
        m.startDrawingPolygon();
      }
    });
  });

  const addHoleBtn = document.getElementById('add-hole');
  addHoleBtn?.addEventListener('click', () => {
    import('../tools/draw').then((m) => {
      if (m.getDrawingModeKind?.() === 'hole') {
        m.finishDrawingRoute();
        return;
      }

      if (!m.isDrawingMode()) {
        const route = store.getSelectedRoute();
        if (!route || !isPolygonRoute(route)) {
          alert('请先选择一条多边形');
          return;
        }
        m.startDrawingHole(route.id);
      }
    });
  });

  const mergeRoutesBtn = document.getElementById('merge-routes');
  mergeRoutesBtn?.addEventListener('click', openMergeDialog);

  initializeMergeDialog();
  initializeSmoothControls();
  syncEndpointQuickControls();
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
  if (!route || !route.editable) return;

  import('../routes/geometry').then((m) => {
    const selectedPoint = store.selectedPoint;
    const isCurrentRouteSelection =
      selectedPoint && selectedPoint.routeId === route.id;

    if (isCurrentRouteSelection) {
      const ringIndex = selectedPoint.ringIndex ?? 0;
      if (!isPolygonRoute(route) && selectedPoint.pointIdx === 0) {
        m.prependNodeToRoute(route.id, e.latlng.lat, e.latlng.lng, ringIndex);
      } else {
        m.insertNodeAt(
          route.id,
          e.latlng.lat,
          e.latlng.lng,
          selectedPoint.pointIdx,
          ringIndex
        );
      }
    } else {
      m.addNodeToRoute(route.id, e.latlng.lat, e.latlng.lng);
    }
  });
}

/**
 * 初始化平滑半径控件
 */
function initializeSmoothControls(): void {
  const radiusInput = document.getElementById(
    'smooth-radius'
  ) as HTMLInputElement;
  const radiusDisplay = document.getElementById('smooth-radius-km');

  // 初始化时同步值到 store
  if (radiusInput) {
    store.smoothRadius = parseInt(radiusInput.value) || 20;
    if (radiusDisplay) {
      radiusDisplay.textContent =
        (store.smoothRadius / 1000).toFixed(2) + ' km';
    }
  }

  radiusInput?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    store.smoothRadius = value;
    if (radiusDisplay) {
      radiusDisplay.textContent = (value / 1000).toFixed(2) + ' km';
    }
  });

  [
    'smooth-plus-1',
    'smooth-plus-100',
    'smooth-minus-1',
    'smooth-minus-100',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      const input = document.getElementById(
        'smooth-radius'
      ) as HTMLInputElement;
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

  // 如果关闭编辑模式，清除选中状态和拖拽标记，并关闭添加节点模式
  if (route.editable) {
    store.clearEditHandle();
    store.selectedPoint = null;

    if (addNodeMode) {
      addNodeMode = false;
      const addNodeBtn = document.getElementById('add-node');
      if (addNodeBtn) {
        addNodeBtn.classList.remove('btn-success');
        addNodeBtn.textContent = '添加节点';
      }
      if (store.map) {
        store.map.off('click', handleAddNodeClick);
      }
    }

    // 清除 geometry 模块中的拖拽标记
    import('../routes/geometry').then((m) => m.clearDragMarker());
  }

  route.editable = !route.editable;

  const btn = document.getElementById('toggle-edit');
  if (btn) {
    btn.textContent = route.editable ? '关闭编辑' : '开启编辑';
    btn.classList.toggle('btn-success', route.editable);
  }

  import('../routes/geometry').then((m) => {
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
  const selectedAtTrigger = store.selectedPoint;
  if (!selectedAtTrigger) return;

  import('../routes/geometry').then((m) => {
    const currentSelected = store.selectedPoint;
    if (!currentSelected) return;
    if (
      currentSelected.routeId !== selectedAtTrigger.routeId ||
      currentSelected.pointIdx !== selectedAtTrigger.pointIdx ||
      (currentSelected.ringIndex ?? 0) !== (selectedAtTrigger.ringIndex ?? 0)
    ) {
      return;
    }

    m.deleteNodeFromRoute(
      selectedAtTrigger.routeId,
      selectedAtTrigger.pointIdx,
      selectedAtTrigger.ringIndex ?? 0
    );
  });
}

/**
 * 合并航线对话框状态
 */
let selectedMergeRouteId: string | null = null;

function canMergeRoutes(
  routeA: NonNullable<ReturnType<typeof store.getSelectedRoute>>,
  routeB: (typeof store.routes)[number]
): boolean {
  return !isPolygonRoute(routeA) && !isPolygonRoute(routeB);
}

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

  if (isPolygonRoute(route)) {
    alert('暂不支持多边形合并');
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
  const otherRoutes = store.routes.filter((r) => r.id !== selectedRoute?.id);

  container.innerHTML = '';

  if (otherRoutes.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'merge-route-empty';
    emptyEl.textContent = '没有其他航线可合并';
    container.appendChild(emptyEl);
    return;
  }

  otherRoutes.forEach((route) => {
    const item = document.createElement('div');
    item.className = 'merge-route-item';
    item.dataset.id = route.id;

    const mergeable = selectedRoute
      ? canMergeRoutes(selectedRoute, route)
      : true;
    if (!mergeable) {
      item.classList.add('disabled');
      item.title = '暂不支持多边形合并';
    }

    const colorSpan = document.createElement('span');
    colorSpan.className = 'route-color';
    colorSpan.style.backgroundColor = route.color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'route-name';
    nameSpan.textContent = route.name;

    const pointsSpan = document.createElement('span');
    pointsSpan.className = 'route-points';
    pointsSpan.textContent = getRouteSummary(route);

    item.appendChild(colorSpan);
    item.appendChild(nameSpan);
    item.appendChild(pointsSpan);

    item.addEventListener('click', () => {
      if (!mergeable) return;
      document
        .querySelectorAll('.merge-route-item')
        .forEach((el) => el.classList.remove('selected'));
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

  import('../routes/index').then((m) => {
    const mergedRoute = m.mergeRoutes(route.id, selectedMergeRouteId!);
    if (mergedRoute) {
      closeMergeDialog();
      updateRouteList();
      updatePropertiesPanel();
    } else {
      alert('合并失败，当前仅支持折线合并');
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
    import('../tools/measure').then((m) => m.toggleMeasureMode());
  });

  clearBtn?.addEventListener('click', () => {
    import('../tools/measure').then((m) => m.clearMeasure());
  });
}

/**
 * 初始化导出控件
 */
function updateExportBidirectionalControlState(): void {
  const checkbox = document.getElementById(
    'export-bidirectional'
  ) as HTMLInputElement | null;
  const row = document.getElementById('export-bidirectional-row');
  if (!checkbox) return;

  const selectedRoute = store.getSelectedRoute();
  const hasVisiblePolyline = store.routes.some(
    (route) => route.visible && !isPolygonRoute(route)
  );
  const hasSelectedPolyline = Boolean(
    selectedRoute && !isPolygonRoute(selectedRoute)
  );
  const enabled = hasVisiblePolyline || hasSelectedPolyline;
  const title = enabled ? '仅对折线导出生效' : '当前没有可应用双向导出的折线';

  checkbox.disabled = !enabled;
  checkbox.title = title;
  row?.setAttribute('title', title);
}

function initializeExportControls(): void {
  const exportBtn = document.getElementById('export-btn');
  const segmentBtn = document.getElementById('export-segment');
  const toggleSegmentBtn = document.getElementById('toggle-segment-export');

  exportBtn?.addEventListener('click', () => {
    import('../export/index').then((m) => m.exportData());
  });

  segmentBtn?.addEventListener('click', () => {
    import('../export/index').then((m) => m.exportSegment());
  });

  toggleSegmentBtn?.addEventListener('click', () => {
    import('../tools/segment').then((m) => m.toggleSegmentExportMode());
  });

  const radiusSlider = document.getElementById(
    'segment-search-radius'
  ) as HTMLInputElement;
  const radiusValue = document.getElementById('segment-search-radius-value');
  radiusSlider?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (radiusValue) {
      radiusValue.textContent = value + 'm';
    }
    store.segmentExport.searchRadius = parseInt(value);
  });

  updateExportBidirectionalControlState();
}

/**
 * 初始化热力图控件
 */
function initializeHeatmapControls(): void {
  const enabledCheckbox = document.getElementById(
    'heatmap-enabled'
  ) as HTMLInputElement;
  const radiusSlider = document.getElementById(
    'heatmap-radius'
  ) as HTMLInputElement;
  const blurSlider = document.getElementById(
    'heatmap-blur'
  ) as HTMLInputElement;
  const opacitySlider = document.getElementById(
    'heatmap-opacity'
  ) as HTMLInputElement;
  const gradientSelect = document.getElementById(
    'heatmap-gradient'
  ) as unknown as HTMLSelectElement;

  enabledCheckbox?.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    store.heatmap.enabled = enabled;
    import('../tools/heatmap').then((m) => m.toggleHeatLayer(enabled));
  });

  radiusSlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    const el = document.getElementById('heatmap-radius-value');
    if (el) el.textContent = value.toString();
    store.heatmap.options.radius = value;
    import('../tools/heatmap').then((m) =>
      m.updateCurrentHeatOptions({ radius: value })
    );
  });

  blurSlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    const el = document.getElementById('heatmap-blur-value');
    if (el) el.textContent = value.toString();
    store.heatmap.options.blur = value;
    import('../tools/heatmap').then((m) =>
      m.updateCurrentHeatOptions({ blur: value })
    );
  });

  opacitySlider?.addEventListener('input', (e) => {
    const value = parseInt((e.target as HTMLInputElement).value);
    const el = document.getElementById('heatmap-opacity-value');
    if (el) el.textContent = (value / 100).toString();
    store.heatmap.options.opacity = value / 100;
    import('../tools/heatmap').then((m) =>
      m.updateCurrentHeatOptions({ minOpacity: value / 100 })
    );
  });

  gradientSelect?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value as
      | 'default'
      | 'fire'
      | 'cold'
      | 'grayscale';
    store.heatmap.options.gradient = value;
    import('../tools/heatmap').then((m) =>
      m.updateCurrentHeatOptions({ gradient: value })
    );
  });

  // 隐藏航线复选框
  const hideRouteCheckbox = document.getElementById(
    'heatmap-hide-route'
  ) as HTMLInputElement;
  hideRouteCheckbox?.addEventListener('change', (e) => {
    const hide = (e.target as HTMLInputElement).checked;
    import('../tools/heatmap').then((m) => m.toggleHideRoute(hide));
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
  setRouteSearchQuery(store.uiState.routeSearchQuery);
  updateRouteList();
}

function getRouteSummary(route: (typeof store.routes)[number]): string {
  const vertexCount =
    route.geometryType === 'polygon'
      ? getPointsForRing(route, 0).length +
        (route.holes?.reduce((sum, ring) => sum + ring.length, 0) ?? 0)
      : route.points.length;

  if (!isPolygonRoute(route)) {
    return `${vertexCount} 点`;
  }

  const holeCount = route.holes?.length ?? 0;
  return holeCount > 0
    ? `${vertexCount} 点 · ${holeCount} 洞`
    : `${vertexCount} 点 · 多边形`;
}

/**
 * 更新航线列表显示
 */
export function updateRouteList(): void {
  refreshRouteListView();
}

/**
 * 更新属性面板
 */
function syncEndpointQuickControls(): void {
  const refs = getEndpointQuickControlRefs();
  const addHoleBtn = document.getElementById(
    'add-hole'
  ) as HTMLButtonElement | null;
  if (!refs) {
    if (addHoleBtn) addHoleBtn.disabled = true;
    return;
  }

  const { controls, startBtn, endBtn } = refs;
  const route = store.getSelectedRoute();
  const isEditable = Boolean(route?.editable);
  const polygonEditable = Boolean(
    route && route.editable && isPolygonRoute(route)
  );
  controls.hidden = !isEditable || Boolean(route && isPolygonRoute(route));
  if (addHoleBtn) {
    addHoleBtn.hidden = !route || !isPolygonRoute(route);
    addHoleBtn.disabled = !polygonEditable;
  }

  if (!isEditable || !route) {
    startBtn.classList.remove('btn-active');
    endBtn.classList.remove('btn-active');
    startBtn.disabled = true;
    endBtn.disabled = true;
    return;
  }

  if (isPolygonRoute(route)) {
    startBtn.classList.remove('btn-active');
    endBtn.classList.remove('btn-active');
    startBtn.disabled = true;
    endBtn.disabled = true;
    return;
  }

  const hasPoints = route.points.length > 0;
  startBtn.disabled = !hasPoints;
  endBtn.disabled = !hasPoints;

  const selected = store.selectedPoint;
  const isRouteSelectedPoint = selected && selected.routeId === route.id;

  startBtn.classList.toggle(
    'btn-active',
    Boolean(isRouteSelectedPoint && selected.pointIdx === 0)
  );
  endBtn.classList.toggle(
    'btn-active',
    Boolean(
      isRouteSelectedPoint && selected.pointIdx === route.points.length - 1
    )
  );
}

function selectEndpointQuickly(endpoint: 'start' | 'end'): void {
  const route = store.getSelectedRoute();
  if (!route || !route.editable) return;

  import('../routes/geometry').then((m) => {
    m.selectRouteEndpoint(route.id, endpoint);
  });
}

export function updatePropertiesPanel(): void {
  refreshPropertiesView();
}

/**
 * 更新状态栏
 */
function updateStatusBar(): void {
  clearStatusMessage();
  refreshStatusSummary();
}
