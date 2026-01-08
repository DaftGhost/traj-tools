/* 航线编辑器 - Leaflet + PapaParse + FileSaver */

// Suppress mozPressure deprecation warning from Leaflet library
const originalWarn = console.warn;
console.warn = function (...args) {
  if (
    args[0] &&
    typeof args[0] === 'string' &&
    args[0].includes('mozPressure')
  ) {
    return; // Suppress this specific warning
  }
  originalWarn.apply(console, args);
};

// ==========================================
// UI 状态管理
// ==========================================
const uiState = {
  accordionStates: {
    measure: false, // 测距工具: 默认收起
    smooth: false, // 平滑半径: 默认收起
    export: false, // 导出: 默认收起
    segment: false, // 片段截取: 默认收起
  },
  drawerExpanded: false,
  routeSearchQuery: '',
};

// ==========================================
// 手风琴折叠功能
// ==========================================
function initializeAccordions() {
  const accordions = document.querySelectorAll('.accordion');

  accordions.forEach((accordion) => {
    const header = accordion.querySelector('.accordion-header');
    const section = accordion.dataset.section;

    // 设置初始状态
    if (uiState.accordionStates[section]) {
      accordion.classList.add('active');
      accordion.classList.remove('collapsed');
    } else {
      accordion.classList.remove('active');
      accordion.classList.add('collapsed');
    }

    // 添加点击处理
    header.addEventListener('click', () => toggleAccordion(section));
  });
}

function toggleAccordion(section) {
  const accordion = document.querySelector(
    `.accordion[data-section="${section}"]`
  );
  if (!accordion) return;

  const isExpanded = accordion.classList.contains('active');

  if (isExpanded) {
    accordion.classList.remove('active');
    accordion.classList.add('collapsed');
    uiState.accordionStates[section] = false;
  } else {
    accordion.classList.add('active');
    accordion.classList.remove('collapsed');
    uiState.accordionStates[section] = true;
  }
}

// 键盘快捷键: Alt + 1/2/3/4 切换各个区块
document.addEventListener('keydown', (e) => {
  if (e.altKey) {
    if (e.key === '1') toggleAccordion('measure');
    if (e.key === '2') toggleAccordion('smooth');
    if (e.key === '3') toggleAccordion('export');
    if (e.key === '4') toggleAccordion('segment');
  }
});

// ==========================================
// 底部抽屉功能
// ==========================================
function initializeDrawer() {
  const drawer = document.getElementById('route-drawer');
  const toggleBtn = document.getElementById('drawer-toggle');
  const searchInput = document.getElementById('route-search');
  const selectAllCheckbox = document.getElementById('select-all-routes');

  if (!drawer || !toggleBtn || !searchInput || !selectAllCheckbox) {
    console.warn('抽屉元素未找到，跳过初始化');
    return;
  }

  // 切换抽屉
  toggleBtn.addEventListener('click', () => toggleDrawer());

  // 搜索功能
  searchInput.addEventListener('input', (e) => {
    uiState.routeSearchQuery = e.target.value.toLowerCase();
    filterRoutes();
  });

  // 全选功能
  selectAllCheckbox.addEventListener('change', (e) => {
    const checked = e.target.checked;
    routes.forEach((route) => {
      if (isRouteVisible(route)) {
        route.visible = checked;
        // 更新 UI 中的复选框
        const checkbox = document.querySelector(
          `.route-item-checkbox[data-route-id="${route.id}"]`
        );
        if (checkbox) checkbox.checked = checked;
        // 更新航线可见性
        if (route._display && route._display.layer) {
          if (route.visible) {
            route._display.layer.addTo(map);
          } else {
            map.removeLayer(route._display.layer);
          }
        }
      }
    });
    refreshRoutesList();
  });

  // 键盘快捷键: Alt + D 切换抽屉
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'd') {
      e.preventDefault();
      toggleDrawer();
    }
  });
}

function toggleDrawer() {
  const drawer = document.getElementById('route-drawer');
  if (drawer) {
    drawer.classList.toggle('collapsed');
    uiState.drawerExpanded = !drawer.classList.contains('collapsed');
  }
}

function isRouteVisible(route) {
  if (!uiState.routeSearchQuery) return true;
  return route.name.toLowerCase().includes(uiState.routeSearchQuery);
}

function filterRoutes() {
  const routeItems = document.querySelectorAll('.route-item');
  routeItems.forEach((item) => {
    const routeId = item.dataset.routeId;
    const route = routes.find((r) => r.id === routeId);
    if (route && isRouteVisible(route)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });

  // 更新航线计数
  const visibleCount = routes.filter(isRouteVisible).length;
  const countEl = document.querySelector('.route-count');
  if (countEl) countEl.textContent = `(${visibleCount})`;
}

// ==========================================
// UI 初始化
// ==========================================
function initializeUI() {
  initializeAccordions();
  initializeDrawer();
}

const map = L.map('map', {
  center: [30, 105],
  zoom: 4,
  worldCopyJump: true,
  preferCanvas: true,
});

const mapSelect = document.querySelector('#map-select');

// 天地图 API Key - 从 window.appConfig 加载
const TDT_KEY = window.appConfig?.tiandituApiKey || '';

// 如果没有配置 API 密钥，显示警告
if (!TDT_KEY) {
  console.warn(
    '⚠️ 天地图 API 密钥未配置！\n' +
    '请按以下步骤配置：\n' +
    '1. 复制 config.example.js 为 config.js\n' +
    '2. 在 http://lbs.tianditu.gov.cn/ 申请免费密钥\n' +
    '3. 将密钥填入 config.js 文件\n' +
    '4. 刷新页面'
  );
}

const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap',
  }),

  // 天地图矢量底图 (vector + Chinese annotations)
  tdtVector: L.layerGroup([
    L.tileLayer(`http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
      attribution: '© 天地图',
    }),
    L.tileLayer(`http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
    }),
  ]),

  // 天地图影像底图 (satellite + Chinese annotations)
  tdtSatellite: L.layerGroup([
    L.tileLayer(`http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
      attribution: '© 天地图',
    }),
    L.tileLayer(`http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
    }),
  ]),

  // 天地图地形底图 (terrain + Chinese annotations)
  tdtTerrain: L.layerGroup([
    L.tileLayer(`http://t0.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
      attribution: '© 天地图',
    }),
    L.tileLayer(`http://t0.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`, {
      maxZoom: 18,
    }),
  ]),

  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles © Esri',
    }
  ),
  cartoDark: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '© OpenStreetMap & CartoDB',
    }
  ),
  cartoLight: L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
      attribution: '© OpenStreetMap & CartoDB',
    }
  ),
};

// 使用配置文件中的默认图层，或回退到天地图矢量
const defaultLayerKey = window.appConfig?.defaultMapLayer || 'tdtVector';
let currentLayer = baseLayers[defaultLayerKey] || baseLayers.tdtVector;
currentLayer.addTo(map);

if (mapSelect) {
  mapSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (baseLayers[key]) {
      map.removeLayer(currentLayer);
      currentLayer = baseLayers[key];
      currentLayer.addTo(map);
    }
  });
}

const palette = [
  '#2563eb',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#0ea5e9',
];
let paletteIdx = 0;

// 显示几何简化（数据层/显示层分离）
// - 原始点（route.points）用于编辑/导出/精确吸附
// - 显示点（route._display.*）按 zoom 自适应 Douglas–Peucker 简化
const SIMPLIFY_CONFIG = {
  // zoom 越小（看得越远）容忍像素越大 → 点数越少
  tolerancePxForZoom(zoom) {
    if (zoom >= 16) return 0;
    if (zoom >= 14) return 1;
    if (zoom >= 12) return 2;
    if (zoom >= 10) return 4;
    if (zoom >= 8) return 8;
    return 12;
  },
  // 最少保留点数（避免过度简化导致形状断裂感）
  minPoints: 2,
};

// 联动平滑配置
const SMOOTH_CONFIG = {
  radiusMeters: 20, // 影响半径（米）
};

const routes = [];
let selectedRouteId = null;
let selectedPoint = null; // {routeId, pointIdx}
let pendingAdd = false;

// 轻量编辑：单活动句柄（避免 6000 个可拖拽节点导致卡顿）
let editHandle = null; // { routeId, idx, marker }

// 拖动上下文：记录一次拖动过程中的原始点位等信息
let dragContext = null;

const fileInput = document.querySelector('#file-input');
const toggleEditBtn = document.querySelector('#toggle-edit');
const addNodeBtn = document.querySelector('#add-node');
const deleteNodeBtn = document.querySelector('#delete-node');
const fitBoundsBtn = document.querySelector('#fit-bounds');
const exportBtn = document.querySelector('#export-btn');
const exportFormatSelect = document.querySelector('#export-format');
const routesList = document.querySelector('#routes-list');
const statusEl = document.querySelector('#status');
const smoothRadiusInput = document.querySelector('#smooth-radius');
const smoothRadiusUnitEl = document.querySelector('#smooth-radius-unit');
const smoothRadiusKmEl = document.querySelector('#smooth-radius-km');
const smoothPlus1Btn = document.querySelector('#smooth-plus-1');
const smoothPlus100Btn = document.querySelector('#smooth-plus-100');
const smoothMinus1Btn = document.querySelector('#smooth-minus-1');
const smoothMinus100Btn = document.querySelector('#smooth-minus-100');
const toggleMeasureBtn = document.querySelector('#toggle-measure');
const clearMeasureBtn = document.querySelector('#clear-measure');
const measureSnapEnabledInput = document.querySelector('#measure-snap-enabled');
const measureSnapSelectedOnlyInput = document.querySelector(
  '#measure-snap-selected-only'
);
const measureResultEl = document.querySelector('#measure-result');
const toggleSegmentExportBtn = document.querySelector('#toggle-segment-export');
const exportSegmentBtn = document.querySelector('#export-segment');
const segmentSearchRadiusInput = document.querySelector(
  '#segment-search-radius'
);
const segmentSearchRadiusValueEl = document.querySelector(
  '#segment-search-radius-value'
);
const segmentStatusEl = document.querySelector('#segment-status');

fileInput.addEventListener('change', handleFiles);
toggleEditBtn.addEventListener('click', toggleEditMode);
addNodeBtn.addEventListener('click', toggleAddMode);
deleteNodeBtn.addEventListener('click', deleteSelectedNode);
fitBoundsBtn.addEventListener('click', fitAllBounds);
exportBtn.addEventListener('click', exportData);
map.on('click', onMapClick);
map.on('mousemove', onMapMouseMove);
map.on('zoomend', () => {
  updateAllRoutesDisplayGeometry();
  if (measure.active) renderMeasure(); // zoom 变化会影响吸附与显示
});
addNodeBtn.disabled = true;
deleteNodeBtn.disabled = true;

// 初始化 UI 组件
initializeUI();

// 测距工具（为航线编辑服务：多点 + 实时预览 + 吸附 + 沿线距离）
const MEASURE_CONFIG = {
  snapPx: 12, // 吸附阈值（像素）
  snapEnabled: true,
  snapSelectedOnly: true,
};

const measure = {
  active: false,
  points: [], // { lat, lon, ref?: { routeId, segIdx, segFrac } | null }
  hover: null, // { lat, lon, ref?: {...} | null }
  layer: L.layerGroup(),
};

// 片段截取工具
const segmentExport = {
  active: false,
  startPoint: null, // {lat, lon, ref: {routeId, segIdx, segFrac}}
  endPoint: null, // {lat, lon, ref: {routeId, segIdx, segFrac}}
  searchRadius: 50, // 垂直搜索半径（米）
  foundRoutes: [], // 找到的航线ID列表
  layer: L.layerGroup(),
  hover: null, // {lat, lon, ref: {...} | null}
};

if (toggleMeasureBtn)
  toggleMeasureBtn.addEventListener('click', toggleMeasureMode);
if (clearMeasureBtn)
  clearMeasureBtn.addEventListener('click', () =>
    clearMeasure({ exit: false })
  );
if (measureSnapEnabledInput) {
  measureSnapEnabledInput.addEventListener('change', (e) => {
    MEASURE_CONFIG.snapEnabled = !!e.target.checked;
    if (MEASURE_CONFIG.snapSelectedOnly && !MEASURE_CONFIG.snapEnabled) {
      MEASURE_CONFIG.snapSelectedOnly = false;
      if (measureSnapSelectedOnlyInput)
        measureSnapSelectedOnlyInput.checked = false;
    }
    if (measure.active) renderMeasure();
  });
}
if (measureSnapSelectedOnlyInput) {
  measureSnapSelectedOnlyInput.addEventListener('change', (e) => {
    MEASURE_CONFIG.snapSelectedOnly = !!e.target.checked;
    if (MEASURE_CONFIG.snapSelectedOnly && !MEASURE_CONFIG.snapEnabled) {
      MEASURE_CONFIG.snapEnabled = true;
      if (measureSnapEnabledInput) measureSnapEnabledInput.checked = true;
    }
    if (measure.active) renderMeasure();
  });
}

document.addEventListener('keydown', onDocumentKeyDown);

if (smoothRadiusInput) {
  // Smooth radius control (numeric input + buttons)
  const MIN_RADIUS = 1;
  const MAX_RADIUS = 10000;

  // Initialize from config
  const initMeters = Number(SMOOTH_CONFIG.radiusMeters) || 20;
  const clampedInit = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, initMeters));
  smoothRadiusInput.value = clampedInit;
  updateSmoothRadiusDisplay(clampedInit);

  // Helper: validate and clamp value
  function validateSmoothRadius(value) {
    const num = Number(value);
    if (!Number.isInteger(num)) return null; // Must be integer
    if (num < MIN_RADIUS) return MIN_RADIUS;
    if (num > MAX_RADIUS) return MAX_RADIUS;
    return num;
  }

  // Helper: update display elements
  function updateSmoothRadiusDisplay(meters) {
    if (smoothRadiusUnitEl) {
      smoothRadiusUnitEl.textContent = 'm';
    }
    if (smoothRadiusKmEl) {
      if (meters >= 1000) {
        const km = (meters / 1000).toFixed(1);
        smoothRadiusKmEl.textContent = `(${km} km)`;
        smoothRadiusKmEl.style.display = 'inline';
      } else {
        smoothRadiusKmEl.style.display = 'none';
      }
    }
  }

  // Helper: apply new radius value
  function setSmoothRadius(meters) {
    const valid = validateSmoothRadius(meters);
    if (valid === null) {
      // Invalid input, reset to current valid value
      smoothRadiusInput.value = SMOOTH_CONFIG.radiusMeters;
      return false;
    }
    SMOOTH_CONFIG.radiusMeters = valid;
    smoothRadiusInput.value = valid;
    updateSmoothRadiusDisplay(valid);
    return true;
  }

  // Input change event
  smoothRadiusInput.addEventListener('change', (e) => {
    setSmoothRadius(e.target.value);
  });

  // Input event (for immediate validation feedback)
  smoothRadiusInput.addEventListener('input', (e) => {
    const valid = validateSmoothRadius(e.target.value);
    if (valid !== null) {
      SMOOTH_CONFIG.radiusMeters = valid;
      updateSmoothRadiusDisplay(valid);
    }
  });

  // Button events
  if (smoothPlus1Btn) {
    smoothPlus1Btn.addEventListener('click', () => {
      const current = SMOOTH_CONFIG.radiusMeters;
      setSmoothRadius(current + 1);
    });
  }

  if (smoothPlus100Btn) {
    smoothPlus100Btn.addEventListener('click', () => {
      const current = SMOOTH_CONFIG.radiusMeters;
      setSmoothRadius(current + 100);
    });
  }

  if (smoothMinus1Btn) {
    smoothMinus1Btn.addEventListener('click', () => {
      const current = SMOOTH_CONFIG.radiusMeters;
      setSmoothRadius(current - 1);
    });
  }

  if (smoothMinus100Btn) {
    smoothMinus100Btn.addEventListener('click', () => {
      const current = SMOOTH_CONFIG.radiusMeters;
      setSmoothRadius(current - 100);
    });
  }

  // Keyboard shortcuts
  smoothRadiusInput.addEventListener('keydown', (e) => {
    const current = SMOOTH_CONFIG.radiusMeters;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSmoothRadius(current + 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSmoothRadius(current - 1);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSmoothRadius(current + 100);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSmoothRadius(current - 100);
    }
  });
}

// 片段截取相关事件绑定
if (toggleSegmentExportBtn) {
  toggleSegmentExportBtn.addEventListener('click', () => {
    toggleSegmentExportMode();
  });
}
if (exportSegmentBtn) {
  exportSegmentBtn.addEventListener('click', () => {
    exportRouteSegments();
  });
}
if (segmentSearchRadiusInput && segmentSearchRadiusValueEl) {
  const initRadius = Number(segmentSearchRadiusInput.value) || 50;
  segmentExport.searchRadius = initRadius;
  segmentSearchRadiusValueEl.textContent = `${initRadius} m`;

  segmentSearchRadiusInput.addEventListener('input', (e) => {
    const meters = Number(e.target.value);
    if (!Number.isFinite(meters) || meters <= 0) return;
    segmentExport.searchRadius = meters;
    if (segmentSearchRadiusValueEl) {
      segmentSearchRadiusValueEl.textContent = `${meters} m`;
    }
    if (
      segmentExport.active &&
      (segmentExport.startPoint || segmentExport.endPoint)
    ) {
      // 如果已经选择了起点和终点，重新搜索
      if (segmentExport.startPoint && segmentExport.endPoint) {
        findRoutesInPerpendicularRange();
      }
      renderSegmentExport();
    }
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setMeasureResult(text) {
  if (!measureResultEl) return;
  measureResultEl.textContent = text;
}

function handleFiles(evt) {
  const files = Array.from(evt.target.files || []);
  if (!files.length) return;
  files.forEach((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'geojson' || ext === 'json') {
      parseGeoJsonFile(file);
    } else {
      parseCsvFile(file);
    }
  });
  fileInput.value = '';
}

function parseCsvFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      if (res.errors && res.errors.length) {
        setStatus(`解析失败 ${file.name}: ${res.errors[0].message}`);
        return;
      }
      const data = res.data;
      if (!data.length) {
        setStatus(`文件空: ${file.name}`);
        return;
      }
      const { latKey, lonKey } = detectLatLonKeys(data[0]);
      if (!latKey || !lonKey) {
        setStatus(`缺少经纬度列: ${file.name}`);
        return;
      }
      const points = [];
      data.forEach((row, idx) => {
        const lat = Number(row[latKey]);
        const lon = Number(row[lonKey]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const props = { ...row };
          delete props[latKey];
          delete props[lonKey];
          points.push({ lat, lon, props, seq: idx });
        }
      });
      if (!points.length) {
        setStatus(`未找到有效坐标: ${file.name}`);
        return;
      }
      addRoute({
        name: file.name,
        points,
      });
      setStatus(`已加载 ${file.name}，航点 ${points.length}`);
    },
  });
}

function parseGeoJsonFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const geojson = JSON.parse(e.target.result);

      // Handle FeatureCollection
      if (geojson.type === 'FeatureCollection') {
        let routeCount = 0;
        geojson.features.forEach((feature, idx) => {
          const route = parseGeoJsonFeature(feature, file.name, idx);
          if (route) {
            addRoute(route);
            routeCount++;
          }
        });
        setStatus(`已加载 ${file.name}，航线 ${routeCount}`);
        return;
      }

      // Handle single Feature
      if (geojson.type === 'Feature') {
        const route = parseGeoJsonFeature(geojson, file.name, 0);
        if (route) {
          addRoute(route);
          setStatus(`已加载 ${file.name}，航点 ${route.points.length}`);
        } else {
          setStatus(`不支持的GeoJSON格式: ${file.name}`);
        }
        return;
      }

      // Handle Geometry directly (no Feature wrapper)
      if (geojson.type === 'LineString' || geojson.type === 'MultiLineString') {
        const route = parseGeoJsonGeometry(geojson, file.name);
        if (route) {
          addRoute(route);
          setStatus(`已加载 ${file.name}，航点 ${route.points.length}`);
        } else {
          setStatus(`解析失败: ${file.name}`);
        }
        return;
      }

      setStatus(`不支持的GeoJSON类型: ${geojson.type}`);
    } catch (err) {
      setStatus(`解析失败 ${file.name}: ${err.message}`);
    }
  };
  reader.onerror = () => {
    setStatus(`读取失败 ${file.name}`);
  };
  reader.readAsText(file);
}

function parseGeoJsonFeature(feature, fileName, idx) {
  if (!feature || !feature.geometry) return null;

  const geometry = feature.geometry;
  const route = parseGeoJsonGeometry(geometry, fileName);

  if (route && feature.properties) {
    // Add feature properties to each point
    route.points.forEach((p) => {
      p.props = { ...feature.properties, ...p.props };
    });
  }

  return route;
}

function parseGeoJsonGeometry(geometry, fileName) {
  if (!geometry) return null;

  const type = geometry.type;
  const coordinates = geometry.coordinates;

  if (!coordinates || !Array.isArray(coordinates)) {
    return null;
  }

  let points = [];

  // Handle LineString: [[lon, lat], [lon, lat], ...]
  if (type === 'LineString') {
    points = coordinates
      .map((coord, idx) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          // GeoJSON uses [lon, lat], we need {lat, lon}
          return {
            lat: coord[1],
            lon: coord[0],
            props: coord[2] ? { elevation: coord[2] } : {},
            seq: idx,
          };
        }
        return null;
      })
      .filter((p) => p !== null);
  }

  // Handle MultiLineString: [[[lon, lat], ...], [[lon, lat], ...]]
  else if (type === 'MultiLineString') {
    // For MultiLineString, we'll concatenate all segments into one route
    let seq = 0;
    coordinates.forEach((segment) => {
      if (Array.isArray(segment)) {
        const segmentPoints = segment
          .map((coord, idx) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              return {
                lat: coord[1],
                lon: coord[0],
                props: coord[2] ? { elevation: coord[2] } : {},
                seq: seq++,
              };
            }
            return null;
          })
          .filter((p) => p !== null);
        points = points.concat(segmentPoints);
      }
    });
  }

  if (points.length === 0) {
    return null;
  }

  return {
    name: fileName,
    points: points,
  };
}

function detectLatLonKeys(row) {
  const keys = Object.keys(row).map((k) => k.trim().toLowerCase());
  const rawKeys = Object.keys(row);
  const latIdx = keys.findIndex((k) => ['lat', 'latitude', 'y'].includes(k));
  const lonIdx = keys.findIndex((k) =>
    ['lon', 'lng', 'longitude', 'x'].includes(k)
  );
  return {
    latKey: latIdx >= 0 ? rawKeys[latIdx] : null,
    lonKey: lonIdx >= 0 ? rawKeys[lonIdx] : null,
  };
}

function addRoute({ name, points }) {
  const id = crypto.randomUUID();
  const color = palette[paletteIdx % palette.length];
  paletteIdx += 1;

  // polyline 只渲染“显示几何”（可简化）；原始几何保留在 route.points
  const polyline = L.polyline([], {
    color,
    weight: 3,
  }).addTo(map);

  // 节点 marker 仅在编辑态生成（避免万级 DOM marker 导致卡顿）
  const markers = [];

  const route = {
    id,
    name,
    color,
    points, // 原始点：用于导出/编辑/精确吸附
    polyline,
    markers,
    visible: true,
    editable: false,
    _version: 0,
    _distCache: null, // 原始几何的累计距离缓存（沿线距离）
    _display: null, // 显示几何缓存：{version, zoom, tolPx, idxs, latlngs}
    _markerBuild: null, // marker 构建任务控制
  };
  routes.push(route);
  attachPolylineEvents(route);
  updateRouteDisplayGeometry(route);
  refreshRoutesList();
  fitAllBounds();
  selectRoute(id);
}

function buildMarkerIcon(color, selected = false) {
  const size = selected ? 16 : 14;
  const border = selected ? 3 : 2;
  const radius = size / 2;
  return L.divIcon({
    className: 'route-marker',
    html: `<span style="
      display:block;
      width:${size}px;
      height:${size}px;
      border:${border}px solid ${color};
      border-radius:${radius}px;
      background:#fff;
      box-sizing:border-box;
      box-shadow:${selected ? '0 0 6px #2563eb' : 'none'};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [radius, radius],
  });
}

function createMarker({ routeId, idx, point, color, editable }) {
  const marker = L.marker([point.lat, point.lon], {
    draggable: editable,
    icon: buildMarkerIcon(color, false),
  }).addTo(map);

  marker.on('dragstart', () => {
    const route = getRoute(routeId);
    if (!route) return;
    // 记录当前航线所有点的原始位置，避免在已经平滑后的结果上重复叠加
    dragContext = {
      routeId,
      movedIdx: idx,
      originalPoints: route.points.map((p) => ({ lat: p.lat, lon: p.lon })),
      newPoints: null,
    };
  });

  marker.on('drag', (e) => {
    const route = getRoute(routeId);
    if (!route) return;
    if (!dragContext || dragContext.routeId !== routeId) {
      return;
    }
    const { lat, lng } = e.target.getLatLng();
    smoothUpdatePoint(routeId, idx, lat, lng);
  });

  marker.on('click', (ev) => {
    // 测距模式下：点击节点直接加入测距点（并避免触发 map click 导致重复添加）
    if (measure.active) {
      if (ev?.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
      addMeasurePointFromRouteVertex(routeId, idx);
    }
    selectRoute(routeId);
    selectMarker(routeId, idx);
  });

  marker.on('dragend', (e) => {
    const route = getRoute(routeId);
    if (!route) return;
    const { lat, lng } = e.target.getLatLng();

    // 如果没有拖动上下文，退化为原始的单点移动
    if (!dragContext || dragContext.routeId !== routeId) {
      updatePoint(routeId, idx, lat, lng);
      return;
    }

    // 确保最终一次位置也参与平滑计算
    smoothUpdatePoint(routeId, idx, lat, lng);

    if (
      dragContext.newPoints &&
      dragContext.newPoints.length === route.points.length
    ) {
      dragContext.newPoints.forEach((p, i) => {
        route.points[i].lat = p.lat;
        route.points[i].lon = p.lon;
      });
      markRouteDirty(routeId);
      if (measure.active) renderMeasure();
      setStatus('节点已更新并联动平滑');
    }

    dragContext = null;
  });

  return marker;
}

function attachPolylineEvents(route) {
  route.polyline.on('click', (ev) => {
    // 测距模式下：点击航线优先做吸附测距（避免事件冒泡到 map click）
    if (measure.active) {
      if (ev?.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
      addMeasurePointFromLatLng(ev.latlng, { preferRouteId: route.id });
      return;
    }
    selectRoute(route.id);
    if (route.editable) {
      const idx = findNearestVertexIndex(route, ev.latlng, 18);
      if (idx != null) {
        setEditHandle(route.id, idx);
        setStatus(
          `选中节点: ${idx + 1}（拖动以调整；影响半径 ${SMOOTH_CONFIG.radiusMeters} m）`
        );
      } else {
        setStatus('未命中节点：请靠近节点单击（或放大后再选）');
      }
    }
  });
}

function refreshRoutesList() {
  routesList.innerHTML = '';

  // 过滤可见的航线（根据搜索关键词）
  const visibleRoutes = routes.filter((route) => {
    if (!uiState.routeSearchQuery) return true;
    return route.name.toLowerCase().includes(uiState.routeSearchQuery);
  });

  // 更新航线计数
  const countEl = document.querySelector('.route-count');
  if (countEl) countEl.textContent = `(${visibleRoutes.length})`;

  visibleRoutes.forEach((route) => {
    const div = document.createElement('div');
    div.className = 'route-item';
    div.dataset.routeId = route.id;

    if (selectedRouteId === route.id) {
      div.classList.add('selected');
    }

    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'route-item-checkbox';
    checkbox.dataset.routeId = route.id;
    checkbox.checked = route.visible;
    checkbox.addEventListener('change', () =>
      toggleRoute(route.id, checkbox.checked)
    );

    // 信息区
    const info = document.createElement('div');
    info.className = 'route-item-info';

    const name = document.createElement('div');
    name.className = 'route-item-name';
    name.textContent = route.name;

    const meta = document.createElement('div');
    meta.className = 'route-item-meta';

    const badge = document.createElement('span');
    badge.className = `route-item-badge ${route.editable ? 'editable' : 'locked'}`;
    badge.textContent = route.editable ? '可编辑' : '锁定';

    const pointCount = document.createElement('span');
    pointCount.textContent = `${route.points.length} 点`;

    meta.append(badge, pointCount);
    info.append(name, meta);

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'route-item-actions';

    const selectBtn = document.createElement('button');
    selectBtn.className = 'route-item-btn';
    selectBtn.textContent = '选择';
    selectBtn.addEventListener('click', () => selectRoute(route.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'route-item-btn delete';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => confirmDeleteRoute(route.id));

    actions.append(selectBtn, deleteBtn);

    div.append(checkbox, info, actions);
    routesList.appendChild(div);
  });
}

function toggleRoute(routeId, visible) {
  const route = routes.find((r) => r.id === routeId);
  if (!route) return;
  route.visible = visible;
  // 隐藏时强制关闭编辑能力
  if (!visible && route.editable) {
    route.editable = false;
    if (selectedRouteId === routeId) {
      pendingAdd = false;
    }
    applyEditableToRoute(route);
  }
  if (visible) {
    route.polyline.addTo(map);
    if (route.editable) route.markers.forEach((m) => m.addTo(map));
    updateRouteDisplayGeometry(route);
  } else {
    map.removeLayer(route.polyline);
    route.markers.forEach((m) => map.removeLayer(m));
    if (editHandle && editHandle.routeId === routeId) clearEditHandle();
  }
  refreshRoutesList();
  updateEditButtonText();
  updateEditButtonsState();
  if (selectedRouteId === routeId && !visible) {
    setStatus(`${route.name} 已隐藏，编辑已关闭`);
  }
}

function selectRoute(routeId) {
  selectedRouteId = routeId;
  selectedPoint = null;
  if (editHandle && editHandle.routeId !== routeId) {
    clearEditHandle();
  }
  routes.forEach((r) => {
    const highlighted = r.id === routeId;
    r.polyline.setStyle({
      weight: highlighted ? 5 : 3,
      opacity: highlighted ? 1 : 0.7,
    });
  });
  updateEditButtonText();
  updateEditButtonsState();
  setStatus(
    `选中航线: ${getRoute(routeId)?.name ?? '无'}${getRoute(routeId)?.editable ? '（可编辑）' : '（锁定）'}`
  );
}

function selectMarker(routeId, idx) {
  selectedPoint = { routeId, pointIdx: idx };
  routes.forEach((r) =>
    r.markers.forEach((m, i) => {
      const selected = r.id === routeId && i === idx;
      m.setIcon(buildMarkerIcon(r.color, selected));
    })
  );
  setStatus(`选中节点: ${idx + 1}`);
}

function getRoute(id) {
  return routes.find((r) => r.id === id);
}

function markRouteDirty(routeId) {
  const r = getRoute(routeId);
  if (!r) return;
  r._version = (r._version || 0) + 1;
  // 仅标记缓存失效，真正计算时再按需生成
  r._distCache = null;
  r._display = null;
}

function toggleEditMode() {
  if (!selectedRouteId) {
    setStatus('请先选择航线');
    return;
  }
  const route = getRoute(selectedRouteId);
  if (!route) return;
  if (!route.visible) {
    setStatus('当前航线已隐藏，无法编辑');
    return;
  }
  route.editable = !route.editable;
  if (!route.editable) {
    pendingAdd = false;
  }
  applyEditableToRoute(route);
  updateRouteDisplayGeometry(route);
  refreshRoutesList();
  updateEditButtonText();
  updateEditButtonsState();
  setStatus(
    `${route.name} 已${route.editable ? '开启' : '关闭'}编辑${route.editable ? '（单击航线选择节点后拖动）' : ''}`
  );
}

function applyEditableToRoute(route) {
  // 编辑态：使用“单活动句柄”，避免 6000 个可拖拽节点导致卡顿
  // 非编辑态：不显示节点 marker
  if (route.editable) {
    if (!route.visible) return;
    // 确保没有遗留的批量 marker
    cancelBuildRouteMarkers(route);
    route.markers.forEach((m) => map.removeLayer(m));
    route.markers = [];
    // 进入编辑态时清空句柄，让用户单击航线选择节点
    clearEditHandle();
  } else {
    cancelBuildRouteMarkers(route);
    route.markers.forEach((m) => map.removeLayer(m));
    route.markers = [];
    clearEditHandle();
  }
}

function updateEditButtonText() {
  const route = getRoute(selectedRouteId);
  if (!route) {
    toggleEditBtn.textContent = '开启编辑';
    return;
  }
  toggleEditBtn.textContent = route.editable
    ? '关闭编辑（当前航线）'
    : '开启编辑（当前航线）';
}

function updateEditButtonsState() {
  const route = getRoute(selectedRouteId);
  const editable = route?.editable ?? false;
  const visible = route?.visible ?? false;
  const enabled = editable && visible;
  addNodeBtn.disabled = !enabled;
  deleteNodeBtn.disabled = !enabled;
}

function cancelBuildRouteMarkers(route) {
  if (!route) return;
  if (route._markerBuild && route._markerBuild.cancel)
    route._markerBuild.cancel();
  route._markerBuild = null;
}

function ensurePolylineRawLatLngs(route) {
  if (!route) return;
  const ll = route.polyline.getLatLngs();
  if (!ll || ll.length !== route.points.length) {
    route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
  }
}

function clearEditHandle() {
  if (!editHandle) return;
  if (editHandle.marker && map.hasLayer(editHandle.marker)) {
    map.removeLayer(editHandle.marker);
  }
  editHandle = null;
}

function setEditHandle(routeId, idx) {
  const route = getRoute(routeId);
  if (!route || !route.visible || !route.editable) return;
  if (idx == null || idx < 0 || idx >= route.points.length) return;

  ensurePolylineRawLatLngs(route);

  const p = route.points[idx];
  selectedPoint = { routeId, pointIdx: idx };

  if (!editHandle || !editHandle.marker || editHandle.routeId !== routeId) {
    clearEditHandle();
    const marker = L.marker([p.lat, p.lon], {
      draggable: true,
      icon: buildMarkerIcon(route.color, true),
    }).addTo(map);

    // IMPORTANT: 不要把 idx 固定在闭包里，否则切换选中点后仍会修改第一次的点
    marker.__routeId = routeId;
    marker.__editIdx = idx;

    marker.on('dragstart', () => {
      const rid = marker.__routeId;
      const i = marker.__editIdx;
      const r = getRoute(rid);
      if (!r) return;
      dragContext = buildSmoothDragContext(r, i);
    });

    marker.on('drag', (e) => {
      const rid = marker.__routeId;
      const i = marker.__editIdx;
      const r = getRoute(rid);
      if (!r) return;
      if (!dragContext || dragContext.routeId !== rid) return;
      const { lat, lng } = e.target.getLatLng();
      smoothUpdatePoint(rid, i, lat, lng);
    });

    marker.on('dragend', () => {
      const rid = marker.__routeId;
      const r = getRoute(rid);
      if (!r) return;
      dragContext = null;
      markRouteDirty(rid);
      if (measure.active) renderMeasure();
      setStatus('节点已更新并联动平滑');
    });

    editHandle = { routeId, idx, marker };
  } else {
    editHandle.routeId = routeId;
    editHandle.idx = idx;
    editHandle.marker.__routeId = routeId;
    editHandle.marker.__editIdx = idx;
    editHandle.marker.setIcon(buildMarkerIcon(route.color, true));
    editHandle.marker.setLatLng([p.lat, p.lon]);
  }
}

function findNearestVertexIndex(route, latlng, maxPx = 18) {
  if (!route?.points?.length) return null;
  const clickPt = map.latLngToLayerPoint(latlng);
  const max2 = maxPx * maxPx;
  let bestIdx = null;
  let best2 = Infinity;
  for (let i = 0; i < route.points.length; i += 1) {
    const p = route.points[i];
    const pt = map.latLngToLayerPoint([p.lat, p.lon]);
    const dx = pt.x - clickPt.x;
    const dy = pt.y - clickPt.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best2) {
      best2 = d2;
      bestIdx = i;
    }
  }
  if (best2 <= max2) return bestIdx;
  return null;
}

function buildSmoothDragContext(route, movedIdx) {
  const radius = Number(SMOOTH_CONFIG.radiusMeters) || 0;
  const n = route.points.length;
  const moved = route.points[movedIdx];
  const items = [];

  // 自身
  items.push({ idx: movedIdx, w: 1, lat0: moved.lat, lon0: moved.lon });

  if (radius > 0) {
    // 向后（沿线距离）
    let cum = 0;
    for (let i = movedIdx - 1; i >= 0; i -= 1) {
      const a = route.points[i + 1];
      const b = route.points[i];
      cum += map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;
      const w = Math.max(0, 1 - cum / radius);
      items.push({ idx: i, w, lat0: b.lat, lon0: b.lon });
    }

    // 向前（沿线距离）
    cum = 0;
    for (let i = movedIdx + 1; i < n; i += 1) {
      const a = route.points[i - 1];
      const b = route.points[i];
      cum += map.distance([a.lat, a.lon], [b.lat, b.lon]);
      if (cum > radius) break;
      const w = Math.max(0, 1 - cum / radius);
      items.push({ idx: i, w, lat0: b.lat, lon0: b.lon });
    }
  }

  ensurePolylineRawLatLngs(route);
  return {
    routeId: route.id,
    movedIdx,
    movedOrigin: { lat: moved.lat, lon: moved.lon },
    items,
    latlngs: route.polyline.getLatLngs(),
  };
}

function buildRouteMarkersAsync(route) {
  cancelBuildRouteMarkers(route);
  if (!route.visible || !route.editable) return;

  const token = {
    cancelled: false,
    cancel() {
      this.cancelled = true;
    },
  };
  route._markerBuild = token;

  const total = route.points.length;
  let idx = 0;
  const chunk = 250; // 每帧创建的 marker 数（可按机器性能再调）

  const step = () => {
    if (token.cancelled) return;
    if (!route.visible || !route.editable) return;

    const end = Math.min(total, idx + chunk);
    for (; idx < end; idx += 1) {
      const p = route.points[idx];
      const m = createMarker({
        routeId: route.id,
        idx,
        point: p,
        color: route.color,
        editable: true,
      });
      route.markers[idx] = m;
    }

    setStatus(`正在生成节点句柄：${route.name}（${end}/${total}）`);

    if (idx < total) {
      requestAnimationFrame(step);
    } else {
      route._markerBuild = null;
      setStatus(`节点句柄已就绪：${route.name}（${total}）`);
    }
  };

  requestAnimationFrame(step);
}

function updatePoint(routeId, idx, lat, lon) {
  const route = getRoute(routeId);
  if (!route) return;
  route.points[idx].lat = lat;
  route.points[idx].lon = lon;
  // 编辑态显示原始几何
  if (route.editable) {
    ensurePolylineRawLatLngs(route);
    const latlngs = route.polyline.getLatLngs();
    if (latlngs[idx]) {
      latlngs[idx].lat = lat;
      latlngs[idx].lng = lon;
      route.polyline.redraw();
    } else {
      route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
    }
    if (
      editHandle &&
      editHandle.routeId === routeId &&
      editHandle.idx === idx
    ) {
      editHandle.marker.setLatLng([lat, lon]);
    }
  } else {
    updateRouteDisplayGeometry(route);
  }
  markRouteDirty(routeId);
  if (measure.active) renderMeasure();
  setStatus(`节点已更新: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

// 距离加权联动平滑更新
function smoothUpdatePoint(routeId, movedIdx, newLat, newLon) {
  const route = getRoute(routeId);
  if (!route) return;
  if (!dragContext || dragContext.routeId !== routeId) return;
  if (!dragContext.items || !dragContext.items.length) return;

  ensurePolylineRawLatLngs(route);
  const latlngs = dragContext.latlngs ?? route.polyline.getLatLngs();

  const dLat = newLat - dragContext.movedOrigin.lat;
  const dLon = newLon - dragContext.movedOrigin.lon;

  for (const it of dragContext.items) {
    const lat = it.lat0 + it.w * dLat;
    const lon = it.lon0 + it.w * dLon;
    route.points[it.idx].lat = lat;
    route.points[it.idx].lon = lon;
    if (latlngs[it.idx]) {
      latlngs[it.idx].lat = lat;
      latlngs[it.idx].lng = lon;
    }
    if (route.markers[it.idx]) {
      route.markers[it.idx].setLatLng([lat, lon]);
    }
  }
  route.polyline.redraw();
  if (
    editHandle &&
    editHandle.routeId === routeId &&
    editHandle.idx === movedIdx
  ) {
    editHandle.marker.setLatLng([
      route.points[movedIdx].lat,
      route.points[movedIdx].lon,
    ]);
  }
}

function toggleAddMode() {
  if (pendingAdd) {
    // 关闭添加节点模式
    pendingAdd = false;
    updateAddNodeButton();
    setStatus('已退出添加节点模式');
    return;
  }

  // 开启添加节点模式
  if (!selectedRouteId) {
    setStatus('请先选择航线');
    return;
  }
  const route = getRoute(selectedRouteId);
  if (!route?.visible) {
    setStatus('当前航线已隐藏，无法编辑');
    return;
  }
  if (!route.editable) {
    setStatus('当前航线未开启编辑');
    return;
  }

  // 与其他模式互斥
  if (measure.active) {
    clearMeasure({ exit: true });
  }
  if (segmentExport.active) {
    clearSegmentExport({ exit: true });
  }

  pendingAdd = true;
  updateAddNodeButton();

  // 根据选中点显示不同的提示
  let positionHint = '默认追加到末尾';
  if (selectedPoint && selectedPoint.routeId === route.id) {
    const pointCount = route.points.length;
    if (selectedPoint.pointIdx === 0) {
      positionHint = '将插入到头部';
    } else if (selectedPoint.pointIdx === pointCount - 1) {
      positionHint = '将追加到末尾';
    } else {
      positionHint = '将追加到末尾（选中首末点可改变插入位置）';
    }
  } else {
    positionHint = '请先选中首点或末点，或直接点击地图（默认追加到末尾）';
  }

  setStatus(`添加节点模式已开启，点击地图添加节点（${positionHint}）`);
}

function updateAddNodeButton() {
  if (addNodeBtn) {
    addNodeBtn.textContent = pendingAdd ? '关闭添加节点' : '添加节点';
  }
}

// 保留原函数以兼容可能的调用
function enableAddMode() {
  if (!pendingAdd) {
    toggleAddMode();
  }
}

function onMapClick(e) {
  if (segmentExport.active) {
    addSegmentPoint(e.latlng);
    return;
  }
  if (measure.active) {
    addMeasurePointFromLatLng(e.latlng);
    return;
  }
  if (!pendingAdd) return;
  const { lat, lng } = e.latlng;
  const route = getRoute(selectedRouteId);
  if (!route || !route.visible || !route.editable) return;

  // 智能判断插入位置
  let insertIndex;
  let insertPosition = '末尾'; // 用于状态提示

  if (selectedPoint && selectedPoint.routeId === route.id) {
    const pointCount = route.points.length;
    // 如果选中了首点，在头部插入
    if (selectedPoint.pointIdx === 0) {
      insertIndex = 0;
      insertPosition = '头部';
    }
    // 如果选中了末点，在尾部追加
    else if (selectedPoint.pointIdx === pointCount - 1) {
      insertIndex = pointCount;
      insertPosition = '末尾';
    }
    // 如果选中了中间点，默认在尾部追加
    else {
      insertIndex = pointCount;
      insertPosition = '末尾';
    }
  } else {
    // 如果没有选中点，默认在尾部追加
    insertIndex = route.points.length;
    insertPosition = '末尾';
  }

  // 插入节点
  const newPoint = { lat, lon: lng, props: {}, seq: insertIndex };
  route.points.splice(insertIndex, 0, newPoint);

  // 如果在头部插入，需要更新所有点的序列号
  if (insertIndex === 0) {
    route.points.forEach((p, i) => (p.seq = i));
  }

  ensurePolylineRawLatLngs(route);
  route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
  setEditHandle(route.id, insertIndex);
  // 移除自动关闭逻辑，使添加节点模式持续有效
  // pendingAdd = false;
  markRouteDirty(route.id);
  updateRouteDisplayGeometry(route);
  if (measure.active) renderMeasure();
  setStatus(`已添加节点到${insertPosition}，继续点击地图可继续添加`);
}

function deleteSelectedNode() {
  if (!selectedPoint) {
    setStatus('请先选择要删除的节点');
    return;
  }
  const { routeId, pointIdx } = selectedPoint;
  const route = getRoute(routeId);
  if (!route) return;
  if (!route.visible) {
    setStatus('当前航线已隐藏，无法编辑');
    return;
  }
  if (!route.editable) {
    setStatus('当前航线未开启编辑');
    return;
  }
  if (route.points.length <= 1) {
    setStatus('至少保留一个节点');
    return;
  }
  const marker = route.markers[pointIdx];
  if (marker) map.removeLayer(marker);
  if (route.markers.length) route.markers.splice(pointIdx, 1);
  route.points.splice(pointIdx, 1);
  route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
  // 单活动句柄：删除后若句柄存在，直接清空（让用户重新选择）
  if (editHandle && editHandle.routeId === routeId) {
    clearEditHandle();
  }
  selectedPoint = null;
  markRouteDirty(routeId);
  updateRouteDisplayGeometry(route);
  if (measure.active) renderMeasure();
  setStatus('节点已删除');
}

function confirmDeleteRoute(routeId) {
  const route = getRoute(routeId);
  if (!route) return;

  const confirmed = confirm(
    `确定要删除航线 "${route.name}" 吗？\n\n此操作不可撤销。`
  );
  if (confirmed) {
    deleteRoute(routeId);
  }
}

function deleteRoute(routeId) {
  const routeIndex = routes.findIndex((r) => r.id === routeId);
  if (routeIndex === -1) return;

  const route = routes[routeIndex];

  // 1. 清理地图上的折线
  if (route.polyline && map.hasLayer(route.polyline)) {
    map.removeLayer(route.polyline);
  }

  // 2. 清理所有标记
  if (route.markers && route.markers.length) {
    route.markers.forEach((marker) => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    route.markers = [];
  }

  // 3. 取消可能正在进行的标记构建任务
  cancelBuildRouteMarkers(route);

  // 4. 清理编辑句柄 (如果正在编辑此航线)
  if (editHandle && editHandle.routeId === routeId) {
    clearEditHandle();
  }

  // 5. 清除选中状态 (如果选中的是被删除的航线)
  if (selectedRouteId === routeId) {
    selectedRouteId = null;
    selectedPoint = null;
  }

  // 6. 从数组中移除航线
  routes.splice(routeIndex, 1);

  // 7. 刷新航线列表
  refreshRoutesList();

  // 8. 更新状态提示
  setStatus(`已删除航线: ${route.name}`);
}

function fitAllBounds() {
  const latlngs = routes
    .filter((r) => r.visible)
    .flatMap((r) => r.points.map((p) => [p.lat, p.lon]));
  if (!latlngs.length) return;
  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds, { padding: [20, 20] });
}

function updateAllRoutesDisplayGeometry() {
  routes.forEach((r) => {
    if (!r.visible) return;
    updateRouteDisplayGeometry(r);
  });
}

function updateRouteDisplayGeometry(route) {
  if (!route || !route.polyline) return;
  if (!route.visible) return;

  // 编辑态：显示原始几何，保证编辑与导出一致
  if (route.editable) {
    route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
    return;
  }

  const zoom = map.getZoom();
  const tolPx = SIMPLIFY_CONFIG.tolerancePxForZoom(zoom);
  const version = route._version || 0;

  // 缓存命中：同版本、同 zoom、同容差
  if (
    route._display &&
    route._display.version === version &&
    route._display.zoom === zoom &&
    route._display.tolPx === tolPx
  ) {
    route.polyline.setLatLngs(route._display.latlngs);
    return;
  }

  const idxs = simplifyRouteIndices(route, zoom, tolPx);
  const latlngs = idxs.map((i) => [route.points[i].lat, route.points[i].lon]);
  route._display = { version, zoom, tolPx, idxs, latlngs };
  route.polyline.setLatLngs(latlngs);
}

function simplifyRouteIndices(route, zoom, tolPx) {
  const n = route.points.length;
  if (n <= SIMPLIFY_CONFIG.minPoints)
    return Array.from({ length: n }, (_, i) => i);
  if (!Number.isFinite(tolPx) || tolPx <= 0)
    return Array.from({ length: n }, (_, i) => i);

  // 以 zoom 级别的像素坐标做简化（视图自适应）
  const pts = route.points.map((p) => map.project([p.lat, p.lon], zoom));
  const sqTol = tolPx * tolPx;
  return douglasPeuckerIndices(pts, sqTol);
}

function douglasPeuckerIndices(pts, sqTol) {
  const n = pts.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    const a = pts[first];
    const b = pts[last];
    for (let i = first + 1; i < last; i += 1) {
      const sq = sqSegDist(pts[i], a, b);
      if (sq > maxSq) {
        maxSq = sq;
        index = i;
      }
    }
    if (index >= 0 && maxSq > sqTol) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const idxs = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) idxs.push(i);
  return idxs;
}

function sqSegDist(p, a, b) {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function exportData() {
  const format = exportFormatSelect ? exportFormatSelect.value : 'csv';
  const visibleRoutes = routes.filter((r) => r.visible);
  if (!visibleRoutes.length) {
    setStatus('无可导出的可见航线');
    return;
  }

  if (format === 'geojson') {
    exportGeoJson(visibleRoutes);
  } else {
    exportCsv(visibleRoutes);
  }
}

function exportCsv(visibleRoutes) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  visibleRoutes.forEach((route, rIdx) => {
    const rows = route.points.map((p, idx) => ({
      route_id: route.name,
      seq: idx,
      lat: p.lat,
      lon: p.lon,
      ...p.props,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const safeName =
      route.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `route_${rIdx + 1}`;
    saveAs(blob, `${safeName}-${stamp}.csv`);
  });
  setStatus(`已导出 ${visibleRoutes.length} 条可见航线 (CSV)`);
}

function exportGeoJson(visibleRoutes) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Create FeatureCollection
  const featureCollection = {
    type: 'FeatureCollection',
    features: visibleRoutes.map((route) => {
      // GeoJSON uses [lon, lat] coordinate order
      const coordinates = route.points.map((p) => {
        const coord = [p.lon, p.lat];
        // Include elevation if available
        if (p.props && p.props.elevation) {
          coord.push(Number(p.props.elevation));
        }
        return coord;
      });

      return {
        type: 'Feature',
        properties: {
          name: route.name,
          color: route.color,
          pointCount: route.points.length,
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
        },
      };
    }),
  };

  const geojson = JSON.stringify(featureCollection, null, 2);
  const blob = new Blob([geojson], { type: 'application/json;charset=utf-8;' });
  saveAs(blob, `routes-${stamp}.geojson`);
  setStatus(`已导出 ${visibleRoutes.length} 条可见航线 (GeoJSON)`);
}

// =========================
// 测距工具：MVP + 吸附 + 沿线距离
// =========================

function toggleMeasureMode() {
  if (measure.active) {
    clearMeasure({ exit: true });
    return;
  }
  // 开启测距：与“添加节点”互斥
  pendingAdd = false;
  measure.active = true;
  measure.points = [];
  measure.hover = null;
  measure.layer.addTo(map);
  updateMeasureButtons();
  renderMeasure();
  updateMeasureResult();
}

function clearMeasure({ exit } = { exit: false }) {
  measure.points = [];
  measure.hover = null;
  measure.layer.clearLayers();
  if (exit) {
    measure.active = false;
    if (map.hasLayer(measure.layer)) map.removeLayer(measure.layer);
  }
  updateMeasureButtons();
  updateMeasureResult();
}

function undoMeasurePoint() {
  if (!measure.active) return;
  if (!measure.points.length) return;
  measure.points.pop();
  updateMeasureButtons();
  scheduleRenderMeasure();
}

function updateMeasureButtons() {
  if (toggleMeasureBtn)
    toggleMeasureBtn.textContent = measure.active ? '关闭测距' : '开启测距';
  if (clearMeasureBtn) clearMeasureBtn.disabled = !measure.active;
}

function onDocumentKeyDown(e) {
  if (segmentExport.active) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleSegmentExportMode();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      clearSegmentSelection();
    }
    return;
  }
  if (pendingAdd) {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleAddMode();
      return;
    }
  }
  if (!measure.active) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    clearMeasure({ exit: true });
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    undoMeasurePoint();
  }
}

function onMapMouseMove(e) {
  if (segmentExport.active) {
    updateSegmentHover(e.latlng);
    return;
  }
  if (!measure.active) return;
  if (!measure.points.length) {
    measure.hover = null;
    updateMeasureResult();
    return;
  }
  const preferRouteId = MEASURE_CONFIG.snapSelectedOnly
    ? selectedRouteId
    : null;
  const snapped = snapToRoutes(e.latlng, preferRouteId);
  const ll = snapped?.latlng ?? e.latlng;
  measure.hover = { lat: ll.lat, lon: ll.lng, ref: snapped?.ref ?? null };
  scheduleRenderMeasure();
}

function addMeasurePointFromLatLng(latlng, { preferRouteId } = {}) {
  if (!measure.active) return;
  const preferred =
    preferRouteId ?? (MEASURE_CONFIG.snapSelectedOnly ? selectedRouteId : null);
  const snapped = snapToRoutes(latlng, preferred);
  const ll = snapped?.latlng ?? latlng;
  measure.points.push({ lat: ll.lat, lon: ll.lng, ref: snapped?.ref ?? null });
  updateMeasureButtons();
  scheduleRenderMeasure();
}

function addMeasurePointFromRouteVertex(routeId, vertexIdx) {
  if (!measure.active) return;
  const route = getRoute(routeId);
  if (!route) return;
  const p = route.points?.[vertexIdx];
  if (!p) return;

  let ref = null;
  if (route.points.length >= 2) {
    if (vertexIdx >= route.points.length - 1) {
      ref = { routeId, segIdx: route.points.length - 2, segFrac: 1 };
    } else {
      ref = { routeId, segIdx: vertexIdx, segFrac: 0 };
    }
  }
  measure.points.push({ lat: p.lat, lon: p.lon, ref });
  updateMeasureButtons();
  scheduleRenderMeasure();
}

function scheduleRenderMeasure() {
  if (!measure.active) return;
  if (measure._raf) return;
  measure._raf = requestAnimationFrame(() => {
    measure._raf = null;
    renderMeasure();
  });
}

function renderMeasure() {
  if (!measure.active) return;
  measure.layer.clearLayers();

  const fixed = measure.points.map((p) => L.latLng(p.lat, p.lon));
  const hover = measure.hover
    ? L.latLng(measure.hover.lat, measure.hover.lon)
    : null;

  // 固定点 marker
  fixed.forEach((ll, idx) => {
    L.circleMarker(ll, {
      radius: 6,
      weight: 2,
      color: '#7c3aed',
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindTooltip(`${idx + 1}`, {
        permanent: true,
        direction: 'center',
        opacity: 0.9,
      })
      .addTo(measure.layer);
  });

  // 固定折线
  if (fixed.length >= 2) {
    L.polyline(fixed, { color: '#7c3aed', weight: 3, opacity: 0.95 }).addTo(
      measure.layer
    );

    for (let i = 0; i < fixed.length - 1; i += 1) {
      const a = measure.points[i];
      const b = measure.points[i + 1];
      const straight = distanceMeters(a.lat, a.lon, b.lat, b.lon);
      const along = getAlongRouteDistanceMeters(a.ref, b.ref);

      const mid = L.latLng((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
      const content = along
        ? `直线 ${formatMeters(straight)}\n沿线 ${formatMeters(along.meters)}\n${along.routeName}`
        : `直线 ${formatMeters(straight)}`;

      L.tooltip({ permanent: true, direction: 'center', opacity: 0.9 })
        .setLatLng(mid)
        .setContent(content)
        .addTo(measure.layer);
    }
  }

  // hover 预览线
  if (hover && fixed.length >= 1) {
    const last = measure.points[measure.points.length - 1];
    const a = last;
    const b = measure.hover;
    const straight = distanceMeters(a.lat, a.lon, b.lat, b.lon);
    const along = getAlongRouteDistanceMeters(a.ref, b.ref);
    const previewTotal = computeMeasureTotalMeters(measure.points) + straight;

    L.polyline([fixed[fixed.length - 1], hover], {
      color: '#7c3aed',
      weight: 2,
      opacity: 0.6,
      dashArray: '6 6',
    }).addTo(measure.layer);

    const mid = L.latLng((a.lat + b.lat) / 2, (a.lon + b.lon) / 2);
    const content = along
      ? `预览：直线 ${formatMeters(straight)} / 沿线 ${formatMeters(along.meters)}\n预计总长 ${formatMeters(previewTotal)}`
      : `预览：直线 ${formatMeters(straight)}\n预计总长 ${formatMeters(previewTotal)}`;

    L.tooltip({ permanent: true, direction: 'top', opacity: 0.9 })
      .setLatLng(mid)
      .setContent(content)
      .addTo(measure.layer);
  }

  updateMeasureResult();
}

function updateMeasureResult() {
  if (!measure.active) {
    setMeasureResult('未开启');
    return;
  }

  const lines = [];
  lines.push('距离：球面（Leaflet）');
  lines.push(
    `吸附：${MEASURE_CONFIG.snapEnabled ? `开启（阈值 ${MEASURE_CONFIG.snapPx}px）` : '关闭'}` +
      `${MEASURE_CONFIG.snapEnabled && MEASURE_CONFIG.snapSelectedOnly ? '；仅当前选中航线' : ''}`
  );
  if (
    MEASURE_CONFIG.snapEnabled &&
    MEASURE_CONFIG.snapSelectedOnly &&
    !selectedRouteId
  ) {
    lines.push('提示：当前未选中航线，将退化为对全部可见航线吸附');
  }

  if (!measure.points.length) {
    lines.push('单击地图/航线/节点添加测距点');
    setMeasureResult(lines.join('\n'));
    return;
  }

  lines.push(`点数：${measure.points.length}`);

  let totalStraight = 0;
  let allOnSameRouteId = null;
  for (const p of measure.points) {
    if (!p.ref?.routeId) {
      allOnSameRouteId = null;
      break;
    }
    if (allOnSameRouteId == null) allOnSameRouteId = p.ref.routeId;
    else if (allOnSameRouteId !== p.ref.routeId) {
      allOnSameRouteId = null;
      break;
    }
  }

  for (let i = 0; i < measure.points.length - 1; i += 1) {
    const a = measure.points[i];
    const b = measure.points[i + 1];
    const straight = distanceMeters(a.lat, a.lon, b.lat, b.lon);
    totalStraight += straight;

    const along = getAlongRouteDistanceMeters(a.ref, b.ref);
    lines.push(
      along
        ? `段 ${i + 1}：直线 ${formatMeters(straight)}；沿线 ${formatMeters(along.meters)}（${along.routeName}）`
        : `段 ${i + 1}：直线 ${formatMeters(straight)}`
    );
  }
  lines.push(`总长（直线累计）：${formatMeters(totalStraight)}`);

  // 首末点沿线总长（只有当全部点都吸附在同一条航线上才有意义）
  if (allOnSameRouteId && measure.points.length >= 2) {
    const first = measure.points[0];
    const last = measure.points[measure.points.length - 1];
    const alongAll = getAlongRouteDistanceMeters(first.ref, last.ref);
    if (alongAll)
      lines.push(
        `首末沿线总长：${formatMeters(alongAll.meters)}（${alongAll.routeName}）`
      );
  }

  setMeasureResult(lines.join('\n'));
}

function formatMeters(m) {
  if (!Number.isFinite(m)) return '-';
  if (m < 1000) return `${m.toFixed(m < 100 ? 1 : 0)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 3 : 2)} km`;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  return map.distance([lat1, lon1], [lat2, lon2]);
}

function computeMeasureTotalMeters(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    sum += distanceMeters(a.lat, a.lon, b.lat, b.lon);
  }
  return sum;
}

// -------- 吸附：最近线段/节点（像素空间）--------

function snapToRoutes(latlng, preferRouteId) {
  if (!MEASURE_CONFIG.snapEnabled) return null;
  const clickPt = map.latLngToLayerPoint(latlng);
  const candidates = [];

  const visibleRoutes = routes.filter((r) => r.visible);
  const prefer = preferRouteId
    ? visibleRoutes.find((r) => r.id === preferRouteId)
    : null;
  if (prefer) candidates.push(prefer);
  // 若“仅当前选中航线”开启但没有选中（或找不到），退化为全部可见航线
  if (!MEASURE_CONFIG.snapSelectedOnly || !prefer) {
    visibleRoutes.forEach((r) => {
      if (!prefer || r.id !== prefer.id) candidates.push(r);
    });
  }

  // best:
  // - coarse: {dist2, routeId, geomType, segIdx, segFrac, layerPoint}
  //   geomType: 'raw' | 'display'
  //   segIdx: 若 display，则是 display segment index；若 raw，则是 raw segment index
  let best = null;
  let bestRoute = null;

  for (const route of candidates) {
    if (!route.points || route.points.length < 2) continue;
    // 粗检：非编辑态用“显示几何（简化）”，编辑态用原始几何
    const geom = getRouteSnapGeometry(route);
    const pts = geom.latlngs.map((ll) => map.latLngToLayerPoint(ll));

    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      const cp = closestPointOnSegmentPx(clickPt, a, b);
      if (!best || cp.dist2 < best.dist2) {
        best = {
          dist2: cp.dist2,
          routeId: route.id,
          geomType: geom.type,
          segIdx: i,
          segFrac: cp.t,
          layerPoint: L.point(cp.x, cp.y),
        };
        bestRoute = route;
      }
    }
  }

  if (!best) return null;
  const threshold2 = MEASURE_CONFIG.snapPx * MEASURE_CONFIG.snapPx;
  if (best.dist2 > threshold2) return null;

  // 细化：若粗检使用的是简化几何，需要在对应的原始段范围内再找一次最近点，
  // 得到“原始 segIdx/segFrac”，以保证沿线距离/编辑一致。
  let final = null; // {segIdx, segFrac, layerPoint}
  if (best.geomType === 'display' && bestRoute) {
    const disp = getRouteDisplayCache(bestRoute);
    const idx0 = disp.idxs[best.segIdx];
    const idx1 = disp.idxs[best.segIdx + 1];
    const start = Math.min(idx0, idx1);
    const end = Math.max(idx0, idx1);
    final = refineSnapOnRawRange(bestRoute, clickPt, start, end);
  } else {
    final = {
      segIdx: best.segIdx,
      segFrac: best.segFrac,
      layerPoint: best.layerPoint,
    };
  }

  if (!final) return null;

  // 归一化：靠近端点则钉到端点，便于沿线距离稳定
  let segFrac = final.segFrac;
  if (segFrac < 1e-6) segFrac = 0;
  if (segFrac > 1 - 1e-6) segFrac = 1;

  const snappedLatLng = map.layerPointToLatLng(final.layerPoint);
  return {
    latlng: snappedLatLng,
    ref: { routeId: best.routeId, segIdx: final.segIdx, segFrac },
  };
}

function getRouteDisplayCache(route) {
  const zoom = map.getZoom();
  const tolPx = SIMPLIFY_CONFIG.tolerancePxForZoom(zoom);
  const version = route._version || 0;
  if (
    route._display &&
    route._display.version === version &&
    route._display.zoom === zoom &&
    route._display.tolPx === tolPx
  ) {
    return route._display;
  }
  // 没有显示缓存时先生成一次
  const idxs = simplifyRouteIndices(route, zoom, tolPx);
  const latlngs = idxs.map((i) => [route.points[i].lat, route.points[i].lon]);
  route._display = { version, zoom, tolPx, idxs, latlngs };
  return route._display;
}

function getRouteSnapGeometry(route) {
  // 编辑态：吸附使用原始几何（精确）
  if (route.editable) {
    return { type: 'raw', latlngs: route.points.map((p) => [p.lat, p.lon]) };
  }
  // 非编辑态：优先用显示几何（简化）做粗检
  const disp = getRouteDisplayCache(route);
  return { type: 'display', latlngs: disp.latlngs };
}

function refineSnapOnRawRange(route, clickPt, rawStartIdx, rawEndIdx) {
  if (!route.points || route.points.length < 2) return null;
  const start = Math.max(0, Math.min(route.points.length - 2, rawStartIdx));
  const end = Math.max(start + 1, Math.min(route.points.length - 1, rawEndIdx));

  let best = null; // {dist2, segIdx, segFrac, layerPoint}
  for (let i = start; i < end; i += 1) {
    const a = map.latLngToLayerPoint([
      route.points[i].lat,
      route.points[i].lon,
    ]);
    const b = map.latLngToLayerPoint([
      route.points[i + 1].lat,
      route.points[i + 1].lon,
    ]);
    const cp = closestPointOnSegmentPx(clickPt, a, b);
    if (!best || cp.dist2 < best.dist2) {
      best = {
        dist2: cp.dist2,
        segIdx: i,
        segFrac: cp.t,
        layerPoint: L.point(cp.x, cp.y),
      };
    }
  }
  return best;
}

function closestPointOnSegmentPx(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 === 0 ? 0 : (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * abx;
  const y = a.y + t * aby;
  const dx = p.x - x;
  const dy = p.y - y;
  return { x, y, t, dist2: dx * dx + dy * dy };
}

// -------- 沿航线距离：同一路线内的位置差 --------

function getAlongRouteDistanceMeters(refA, refB) {
  if (!refA || !refB) return null;
  if (refA.routeId !== refB.routeId) return null;

  const route = getRoute(refA.routeId);
  if (!route || !route.points || route.points.length < 2) return null;

  const cache = getRouteDistCache(route);
  if (!cache || !cache.segLens.length) return null;

  const s1 = positionAlongRouteMeters(refA, cache);
  const s2 = positionAlongRouteMeters(refB, cache);
  if (!Number.isFinite(s1) || !Number.isFinite(s2)) return null;

  return { meters: Math.abs(s2 - s1), routeName: route.name };
}

function getRouteDistCache(route) {
  const version = route._version || 0;
  if (route._distCache && route._distCache.version === version)
    return route._distCache;

  const segLens = [];
  const cumLens = [0];
  for (let i = 0; i < route.points.length - 1; i += 1) {
    const a = route.points[i];
    const b = route.points[i + 1];
    const len = distanceMeters(a.lat, a.lon, b.lat, b.lon);
    segLens.push(len);
    cumLens.push(cumLens[cumLens.length - 1] + len);
  }

  route._distCache = { version, segLens, cumLens };
  return route._distCache;
}

function positionAlongRouteMeters(ref, cache) {
  const maxSegIdx = cache.segLens.length - 1;
  if (maxSegIdx < 0) return NaN;
  const segIdx = Math.max(0, Math.min(maxSegIdx, ref.segIdx));
  const frac = Math.max(0, Math.min(1, ref.segFrac));
  return cache.cumLens[segIdx] + frac * cache.segLens[segIdx];
}

// =========================
// 片段截取工具：选择起点和终点，垂直搜索，截取片段并导出
// =========================

function toggleSegmentExportMode() {
  if (segmentExport.active) {
    clearSegmentExport({ exit: true });
    return;
  }
  // 与其他模式互斥
  if (measure.active) {
    clearMeasure({ exit: true });
  }
  if (pendingAdd) {
    pendingAdd = false;
  }
  segmentExport.active = true;
  segmentExport.startPoint = null;
  segmentExport.endPoint = null;
  segmentExport.foundRoutes = [];
  segmentExport.hover = null;
  segmentExport.layer.addTo(map);
  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

function clearSegmentExport({ exit } = { exit: false }) {
  segmentExport.startPoint = null;
  segmentExport.endPoint = null;
  segmentExport.foundRoutes = [];
  segmentExport.hover = null;
  segmentExport.layer.clearLayers();
  if (exit) {
    segmentExport.active = false;
    if (map.hasLayer(segmentExport.layer)) map.removeLayer(segmentExport.layer);
  }
  updateSegmentButtons();
  updateSegmentStatus();
}

function clearSegmentSelection() {
  if (!segmentExport.active) return;
  segmentExport.startPoint = null;
  segmentExport.endPoint = null;
  segmentExport.foundRoutes = [];
  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

function updateSegmentButtons() {
  if (toggleSegmentExportBtn) {
    toggleSegmentExportBtn.textContent = segmentExport.active
      ? '关闭片段截取'
      : '开启片段截取';
  }
  if (exportSegmentBtn) {
    exportSegmentBtn.disabled =
      !segmentExport.active ||
      !segmentExport.startPoint ||
      !segmentExport.endPoint;
  }
}

function setSegmentStatus(text) {
  if (segmentStatusEl) {
    segmentStatusEl.textContent = text;
  }
}

function updateSegmentStatus() {
  if (!segmentExport.active) {
    setSegmentStatus('未开启');
    return;
  }
  const lines = [];
  if (!segmentExport.startPoint) {
    lines.push('点击地图选择起点（将吸附到最近的航线）');
  } else if (!segmentExport.endPoint) {
    lines.push('起点已选择');
    lines.push('点击地图选择终点（将吸附到最近的航线）');
  } else {
    lines.push('起点和终点已选择');
    lines.push(`找到 ${segmentExport.foundRoutes.length} 条航线`);
    if (segmentExport.foundRoutes.length > 0) {
      const routeNames = segmentExport.foundRoutes
        .map((id) => getRoute(id)?.name)
        .filter(Boolean)
        .join('、');
      lines.push(`航线：${routeNames}`);
    }
  }
  setSegmentStatus(lines.join('\n'));
}

function addSegmentPoint(latlng) {
  if (!segmentExport.active) return;
  // 启用吸附功能
  const snapped = snapToRoutes(latlng, null);
  const point = {
    lat: snapped?.latlng?.lat ?? latlng.lat,
    lon: snapped?.latlng?.lng ?? latlng.lng,
    ref: snapped?.ref ?? null,
  };
  if (!segmentExport.startPoint) {
    segmentExport.startPoint = point;
    setStatus('起点已选择，请选择终点');
  } else if (!segmentExport.endPoint) {
    segmentExport.endPoint = point;
    // 自动搜索并计算片段
    findRoutesInPerpendicularRange();
    setStatus('终点已选择，已搜索到相关航线');
  } else {
    // 重新选择起点
    segmentExport.startPoint = point;
    segmentExport.endPoint = null;
    segmentExport.foundRoutes = [];
    setStatus('起点已重新选择，请选择终点');
  }
  updateSegmentButtons();
  updateSegmentStatus();
  renderSegmentExport();
}

function updateSegmentHover(latlng) {
  if (!segmentExport.active) return;
  const snapped = snapToRoutes(latlng, null);
  segmentExport.hover = {
    lat: snapped?.latlng?.lat ?? latlng.lat,
    lon: snapped?.latlng?.lng ?? latlng.lng,
    ref: snapped?.ref ?? null,
  };
  scheduleRenderSegmentExport();
}

function scheduleRenderSegmentExport() {
  if (!segmentExport.active) return;
  if (segmentExport._raf) return;
  segmentExport._raf = requestAnimationFrame(() => {
    segmentExport._raf = null;
    renderSegmentExport();
  });
}

function renderSegmentExport() {
  if (!segmentExport.active) return;
  segmentExport.layer.clearLayers();
  const start = segmentExport.startPoint;
  const end = segmentExport.endPoint || segmentExport.hover;
  // 显示起点
  if (start) {
    L.circleMarker([start.lat, start.lon], {
      radius: 8,
      weight: 3,
      color: '#22c55e',
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindTooltip('起点', { permanent: true, direction: 'top' })
      .addTo(segmentExport.layer);
  }
  // 显示终点或hover点
  if (end) {
    const isHover = !segmentExport.endPoint;
    L.circleMarker([end.lat, end.lon], {
      radius: 8,
      weight: 3,
      color: isHover ? '#f59e0b' : '#ef4444',
      fillColor: '#ffffff',
      fillOpacity: 1,
    })
      .bindTooltip(isHover ? '预览终点' : '终点', {
        permanent: true,
        direction: 'top',
      })
      .addTo(segmentExport.layer);
  }
  // 显示起点和终点之间的连线
  if (start && end) {
    L.polyline(
      [
        [start.lat, start.lon],
        [end.lat, end.lon],
      ],
      {
        color: '#7c3aed',
        weight: 2,
        opacity: 0.7,
        dashArray: segmentExport.endPoint ? '0' : '6 6',
      }
    ).addTo(segmentExport.layer);
  }
  // 显示垂直搜索区域（在起点和终点处）
  if (start && start.ref) {
    drawPerpendicularSearchArea(start, segmentExport.searchRadius);
  }
  if (end && end.ref && segmentExport.endPoint) {
    drawPerpendicularSearchArea(end, segmentExport.searchRadius);
  }
  // 高亮显示找到的航线片段
  if (segmentExport.endPoint && segmentExport.foundRoutes.length > 0) {
    segmentExport.foundRoutes.forEach((routeId) => {
      const route = getRoute(routeId);
      if (!route || !route.visible) return;
      const segment = extractRouteSegment(
        route,
        segmentExport.startPoint,
        segmentExport.endPoint
      );
      if (segment && segment.length > 0) {
        L.polyline(
          segment.map((p) => [p.lat, p.lon]),
          {
            color: '#f59e0b',
            weight: 4,
            opacity: 0.8,
          }
        ).addTo(segmentExport.layer);
      }
    });
  }
}

function drawPerpendicularSearchArea(point, radius) {
  if (!point.ref) return;
  const route = getRoute(point.ref.routeId);
  if (!route || route.points.length < 2) return;
  // 获取该位置处的航线段
  const segIdx = point.ref.segIdx;
  if (segIdx < 0 || segIdx >= route.points.length - 1) return;
  const p1 = route.points[segIdx];
  const p2 = route.points[segIdx + 1];
  // 计算该位置的实际坐标
  const frac = point.ref.segFrac;
  const lat = p1.lat + (p2.lat - p1.lat) * frac;
  const lon = p1.lon + (p2.lon - p1.lon) * frac;
  // 计算航线段的方向向量（归一化）
  const dx = p2.lon - p1.lon;
  const dy = p2.lat - p1.lat;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-9) return;
  const dirX = dx / len;
  const dirY = dy / len;
  // 垂直方向（法向量）
  const perpX = -dirY;
  const perpY = dirX;
  // 计算搜索区域的四个角点（在垂直方向两侧延伸radius距离）
  // 使用米到度的近似转换
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const radiusLat = radius / metersPerDegreeLat;
  const radiusLon = radius / metersPerDegreeLon;
  const offsetLat = perpY * radiusLat;
  const offsetLon = perpX * radiusLon;
  const corners = [
    [lat - offsetLat, lon - offsetLon],
    [lat + offsetLat, lon + offsetLon],
  ];
  // 绘制搜索区域（使用圆形更直观）
  L.circle([lat, lon], {
    radius,
    color: '#f59e0b',
    weight: 2,
    opacity: 0.5,
    fillOpacity: 0.1,
    dashArray: '5 5',
  }).addTo(segmentExport.layer);
}

function findRoutesInPerpendicularRange() {
  if (!segmentExport.startPoint || !segmentExport.endPoint) {
    segmentExport.foundRoutes = [];
    return;
  }
  const found = new Set();
  const radius = segmentExport.searchRadius;
  // 获取主航线（起点所在的航线）
  const mainRoute = segmentExport.startPoint.ref
    ? getRoute(segmentExport.startPoint.ref.routeId)
    : null;
  if (mainRoute) {
    found.add(mainRoute.id);
  }
  // 在起点和终点处分别搜索
  [segmentExport.startPoint, segmentExport.endPoint].forEach((point) => {
    if (!point.ref) return;
    const route = getRoute(point.ref.routeId);
    if (!route || route.points.length < 2) return;
    // 获取该位置处的航线段
    const segIdx = point.ref.segIdx;
    if (segIdx < 0 || segIdx >= route.points.length - 1) return;
    const p1 = route.points[segIdx];
    const p2 = route.points[segIdx + 1];
    // 计算该位置的实际坐标
    const frac = point.ref.segFrac;
    const lat = p1.lat + (p2.lat - p1.lat) * frac;
    const lon = p1.lon + (p2.lon - p1.lon) * frac;
    // 计算航线段的方向向量
    const dx = p2.lon - p1.lon;
    const dy = p2.lat - p1.lat;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return;
    const dirX = dx / len;
    const dirY = dy / len;
    // 垂直方向（法向量）
    const perpX = -dirY;
    const perpY = dirX;
    // 搜索所有可见且勾选的航线（visible === true 表示勾选）
    const visibleRoutes = routes.filter((r) => r.visible);
    visibleRoutes.forEach((r) => {
      if (r.id === route.id) {
        // 主航线本身已包含
        return;
      }
      // 检查该航线的线段是否在搜索范围内
      // 使用更精确的方法：检查线段是否与垂直搜索区域相交
      for (let i = 0; i < r.points.length - 1; i += 1) {
        const segStart = r.points[i];
        const segEnd = r.points[i + 1];
        // 计算线段中点到搜索中心点的距离
        const midLat = (segStart.lat + segEnd.lat) / 2;
        const midLon = (segStart.lon + segEnd.lon) / 2;
        const dist = map.distance([lat, lon], [midLat, midLon]);
        if (dist <= radius) {
          found.add(r.id);
          break;
        }
        // 也检查端点
        const dist1 = map.distance([lat, lon], [segStart.lat, segStart.lon]);
        const dist2 = map.distance([lat, lon], [segEnd.lat, segEnd.lon]);
        if (dist1 <= radius || dist2 <= radius) {
          found.add(r.id);
          break;
        }
      }
    });
  });
  segmentExport.foundRoutes = Array.from(found);
  updateSegmentStatus();
}

function extractRouteSegment(route, startPoint, endPoint) {
  if (!route || !route.points || route.points.length < 2) return null;
  if (!startPoint || !endPoint) return null;
  // 如果起点和终点都不在航线上，返回完整航线
  if (!startPoint.ref || startPoint.ref.routeId !== route.id) {
    // 如果起点不在航线上，尝试使用终点
    if (endPoint.ref && endPoint.ref.routeId === route.id) {
      // 只使用终点，从航线起点到终点
      return extractRouteSegmentFromEnd(route, endPoint);
    }
    return null;
  }
  if (!endPoint.ref || endPoint.ref.routeId !== route.id) {
    // 如果终点不在航线上，从起点到航线终点
    return extractRouteSegmentFromStart(route, startPoint);
  }
  const startRef = startPoint.ref;
  const endRef = endPoint.ref;
  // 计算起点和终点在航线上的位置（索引+分数）
  const startPos = startRef.segIdx + startRef.segFrac;
  const endPos = endRef.segIdx + endRef.segFrac;
  // 确保起点在终点之前
  let actualStart = startPos < endPos ? startRef : endRef;
  let actualEnd = startPos < endPos ? endRef : startRef;
  const startSegIdx = actualStart.segIdx;
  const endSegIdx = actualEnd.segIdx;
  // 提取片段
  const segment = [];
  // 如果起点不在节点上，插入起点
  if (actualStart.segFrac > 1e-6) {
    const p1 = route.points[startSegIdx];
    const p2 = route.points[startSegIdx + 1];
    const lat = p1.lat + (p2.lat - p1.lat) * actualStart.segFrac;
    const lon = p1.lon + (p2.lon - p1.lon) * actualStart.segFrac;
    segment.push({ lat, lon, props: {}, seq: 0 });
  } else {
    // 起点在节点上，直接添加
    const p = route.points[startSegIdx];
    segment.push({ lat: p.lat, lon: p.lon, props: p.props || {}, seq: 0 });
  }
  // 添加中间的所有点
  for (let i = startSegIdx + 1; i <= endSegIdx; i += 1) {
    const p = route.points[i];
    segment.push({
      lat: p.lat,
      lon: p.lon,
      props: p.props || {},
      seq: segment.length,
    });
  }
  // 如果终点不在节点上，插入终点
  if (actualEnd.segFrac < 1 - 1e-6 && endSegIdx < route.points.length - 1) {
    const p1 = route.points[endSegIdx];
    const p2 = route.points[endSegIdx + 1];
    const lat = p1.lat + (p2.lat - p1.lat) * actualEnd.segFrac;
    const lon = p1.lon + (p2.lon - p1.lon) * actualEnd.segFrac;
    segment.push({ lat, lon, props: {}, seq: segment.length });
  }
  return segment.length > 0 ? segment : null;
}

function extractRouteSegmentFromStart(route, startPoint) {
  if (!route || !route.points || route.points.length < 2) return null;
  if (!startPoint || !startPoint.ref || startPoint.ref.routeId !== route.id)
    return null;
  const startRef = startPoint.ref;
  const startSegIdx = startRef.segIdx;
  const segment = [];
  // 如果起点不在节点上，插入起点
  if (startRef.segFrac > 1e-6) {
    const p1 = route.points[startSegIdx];
    const p2 = route.points[startSegIdx + 1];
    const lat = p1.lat + (p2.lat - p1.lat) * startRef.segFrac;
    const lon = p1.lon + (p2.lon - p1.lon) * startRef.segFrac;
    segment.push({ lat, lon, props: {}, seq: 0 });
  } else {
    const p = route.points[startSegIdx];
    segment.push({ lat: p.lat, lon: p.lon, props: p.props || {}, seq: 0 });
  }
  // 从起点到航线终点
  for (let i = startSegIdx + 1; i < route.points.length; i += 1) {
    const p = route.points[i];
    segment.push({
      lat: p.lat,
      lon: p.lon,
      props: p.props || {},
      seq: segment.length,
    });
  }
  return segment;
}

function extractRouteSegmentFromEnd(route, endPoint) {
  if (!route || !route.points || route.points.length < 2) return null;
  if (!endPoint || !endPoint.ref || endPoint.ref.routeId !== route.id)
    return null;
  const endRef = endPoint.ref;
  const endSegIdx = endRef.segIdx;
  const segment = [];
  // 从航线起点到终点
  for (let i = 0; i <= endSegIdx; i += 1) {
    const p = route.points[i];
    segment.push({
      lat: p.lat,
      lon: p.lon,
      props: p.props || {},
      seq: segment.length,
    });
  }
  // 如果终点不在节点上，插入终点
  if (endRef.segFrac < 1 - 1e-6 && endSegIdx < route.points.length - 1) {
    const p1 = route.points[endSegIdx];
    const p2 = route.points[endSegIdx + 1];
    const lat = p1.lat + (p2.lat - p1.lat) * endRef.segFrac;
    const lon = p1.lon + (p2.lon - p1.lon) * endRef.segFrac;
    segment.push({ lat, lon, props: {}, seq: segment.length });
  }
  return segment;
}

function exportRouteSegments() {
  if (
    !segmentExport.active ||
    !segmentExport.startPoint ||
    !segmentExport.endPoint
  ) {
    setStatus('请先选择起点和终点');
    return;
  }
  // 只导出在搜索范围内找到的航线的片段
  if (!segmentExport.foundRoutes.length) {
    setStatus('没有找到可导出的航线片段');
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let exportedCount = 0;
  segmentExport.foundRoutes.forEach((routeId) => {
    const route = getRoute(routeId);
    if (!route || !route.visible) return;
    // 导出片段
    const points = extractRouteSegment(
      route,
      segmentExport.startPoint,
      segmentExport.endPoint
    );
    if (!points || points.length === 0) {
      return; // 跳过无法提取片段的航线
    }
    const rows = points.map((p, idx) => ({
      route_id: route.name,
      seq: idx,
      lat: p.lat,
      lon: p.lon,
      ...p.props,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const safeName =
      route.name.replace(/[^a-zA-Z0-9._-]/g, '_') ||
      `route_${exportedCount + 1}`;
    saveAs(blob, `${safeName}-segment-${stamp}.csv`);
    exportedCount += 1;
  });
  setStatus(`已导出 ${exportedCount} 条航线片段`);
}
