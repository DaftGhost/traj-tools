/* 航线编辑器 - Leaflet + PapaParse + FileSaver */

const map = L.map('map', {
  center: [30, 105],
  zoom: 4,
  worldCopyJump: true,
});

const mapSelect = document.querySelector('#map-select');
const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap',
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
  }),
  cartoDark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap & CartoDB',
  }),
  cartoLight: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap & CartoDB',
  }),

};

let currentLayer = baseLayers.osm;
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

const palette = ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#0ea5e9'];
let paletteIdx = 0;

// 联动平滑配置
const SMOOTH_CONFIG = {
  radiusDeg: 20 / 111000, // 影响半径（以度为单位，约 20m）
};

const routes = [];
let selectedRouteId = null;
let selectedPoint = null; // {routeId, pointIdx}
let pendingAdd = false;

// 拖动上下文：记录一次拖动过程中的原始点位等信息
let dragContext = null;

const fileInput = document.querySelector('#file-input');
const toggleEditBtn = document.querySelector('#toggle-edit');
const addNodeBtn = document.querySelector('#add-node');
const deleteNodeBtn = document.querySelector('#delete-node');
const fitBoundsBtn = document.querySelector('#fit-bounds');
const exportBtn = document.querySelector('#export-csv');
const routesList = document.querySelector('#routes-list');
const statusEl = document.querySelector('#status');
const smoothRadiusInput = document.querySelector('#smooth-radius');
const smoothRadiusValueEl = document.querySelector('#smooth-radius-value');

fileInput.addEventListener('change', handleFiles);
toggleEditBtn.addEventListener('click', toggleEditMode);
addNodeBtn.addEventListener('click', enableAddMode);
deleteNodeBtn.addEventListener('click', deleteSelectedNode);
fitBoundsBtn.addEventListener('click', fitAllBounds);
exportBtn.addEventListener('click', exportCsv);
map.on('click', onMapClick);
addNodeBtn.disabled = true;
deleteNodeBtn.disabled = true;

if (smoothRadiusInput && smoothRadiusValueEl) {
  // 初始显示（滑块单位：米）
  const initMeters = Number(smoothRadiusInput.value) || 20;
  const initDeg = initMeters / 111000;
  SMOOTH_CONFIG.radiusDeg = initDeg;
  smoothRadiusValueEl.textContent = `${initMeters} m`;

  smoothRadiusInput.addEventListener('input', (e) => {
    const meters = Number(e.target.value);
    if (!Number.isFinite(meters) || meters <= 0) return;
    const deg = meters / 111000; // 粗略按纬度 1° ≈ 111km 换算
    SMOOTH_CONFIG.radiusDeg = deg;
    smoothRadiusValueEl.textContent = `${meters} m`;
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function handleFiles(evt) {
  const files = Array.from(evt.target.files || []);
  if (!files.length) return;
  files.forEach((file) => parseCsvFile(file));
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

function detectLatLonKeys(row) {
  const keys = Object.keys(row).map((k) => k.trim().toLowerCase());
  const rawKeys = Object.keys(row);
  const latIdx = keys.findIndex((k) => ['lat', 'latitude', 'y'].includes(k));
  const lonIdx = keys.findIndex((k) => ['lon', 'lng', 'longitude', 'x'].includes(k));
  return {
    latKey: latIdx >= 0 ? rawKeys[latIdx] : null,
    lonKey: lonIdx >= 0 ? rawKeys[lonIdx] : null,
  };
}

function addRoute({ name, points }) {
  const id = crypto.randomUUID();
  const color = palette[paletteIdx % palette.length];
  paletteIdx += 1;

  const polyline = L.polyline(points.map((p) => [p.lat, p.lon]), {
    color,
    weight: 3,
  }).addTo(map);

  const markers = points.map((p, idx) => createMarker({ routeId: id, idx, point: p, color, editable: false }));

  const route = { id, name, color, points, polyline, markers, visible: true, editable: false };
  routes.push(route);
  attachPolylineEvents(route);
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

  marker.on('click', () => {
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

    if (dragContext.newPoints && dragContext.newPoints.length === route.points.length) {
      dragContext.newPoints.forEach((p, i) => {
        route.points[i].lat = p.lat;
        route.points[i].lon = p.lon;
      });
      setStatus(`节点已更新并联动平滑`);
    }

    dragContext = null;
  });

  return marker;
}

function attachPolylineEvents(route) {
  route.polyline.on('click', () => {
    selectRoute(route.id);
  });
}

function refreshRoutesList() {
  routesList.innerHTML = '';
  routes.forEach((route) => {
    const div = document.createElement('div');
    div.className = 'route-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = route.visible;
    checkbox.addEventListener('change', () => toggleRoute(route.id, checkbox.checked));

    const span = document.createElement('span');
    span.textContent = route.name;

    const editBadge = document.createElement('span');
    editBadge.textContent = route.editable ? '可编辑' : '锁定';
    editBadge.style.fontSize = '12px';
    editBadge.style.color = route.editable ? '#16a34a' : '#475569';

    const selectBtn = document.createElement('button');
    selectBtn.textContent = '选择';
    selectBtn.addEventListener('click', () => selectRoute(route.id));

    div.append(checkbox, span, editBadge, selectBtn);
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
    route.markers.forEach((m) => m.addTo(map));
  } else {
    map.removeLayer(route.polyline);
    route.markers.forEach((m) => map.removeLayer(m));
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
  routes.forEach((r) => {
    const highlighted = r.id === routeId;
    r.polyline.setStyle({ weight: highlighted ? 5 : 3, opacity: highlighted ? 1 : 0.7 });
  });
  updateEditButtonText();
  updateEditButtonsState();
  setStatus(`选中航线: ${getRoute(routeId)?.name ?? '无'}${getRoute(routeId)?.editable ? '（可编辑）' : '（锁定）'}`);
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
  refreshRoutesList();
  updateEditButtonText();
  updateEditButtonsState();
  setStatus(`${route.name} 已${route.editable ? '开启' : '关闭'}编辑`);
}

function applyEditableToRoute(route) {
  route.markers.forEach((m) => {
    if (m.dragging && m.dragging.enable) {
      route.editable ? m.dragging.enable() : m.dragging.disable();
    }
  });
}

function updateEditButtonText() {
  const route = getRoute(selectedRouteId);
  if (!route) {
    toggleEditBtn.textContent = '开启编辑';
    return;
  }
  toggleEditBtn.textContent = route.editable ? '关闭编辑（当前航线）' : '开启编辑（当前航线）';
}

function updateEditButtonsState() {
  const route = getRoute(selectedRouteId);
  const editable = route?.editable ?? false;
  const visible = route?.visible ?? false;
  const enabled = editable && visible;
  addNodeBtn.disabled = !enabled;
  deleteNodeBtn.disabled = !enabled;
}

function updatePoint(routeId, idx, lat, lon) {
  const route = getRoute(routeId);
  if (!route) return;
  route.points[idx].lat = lat;
  route.points[idx].lon = lon;
  route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
  route.markers[idx].setLatLng([lat, lon]);
  setStatus(`节点已更新: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}

// 距离加权联动平滑更新
function smoothUpdatePoint(routeId, movedIdx, newLat, newLon) {
  const route = getRoute(routeId);
  if (!route) return;
  if (!dragContext || dragContext.routeId !== routeId) return;

  const original = dragContext.originalPoints;
  if (!original || !original[movedIdx]) return;

  const movedOrigin = original[movedIdx];
  const dLat = newLat - movedOrigin.lat;
  const dLon = newLon - movedOrigin.lon;

  const radius = SMOOTH_CONFIG.radiusDeg || 1.0;
  const radiusSq = radius * radius;

  const newPoints = original.map((p, i) => {
    const dLat0 = p.lat - movedOrigin.lat;
    const dLon0 = p.lon - movedOrigin.lon;
    const distSq = dLat0 * dLat0 + dLon0 * dLon0;

    if (distSq >= radiusSq) {
      // 超出影响半径：不联动
      return { lat: p.lat, lon: p.lon };
    }

    const dist = Math.sqrt(distSq);
    const w = Math.max(0, 1 - dist / radius); // 线性衰减权重

    return {
      lat: p.lat + w * dLat,
      lon: p.lon + w * dLon,
    };
  });

  dragContext.newPoints = newPoints;

  // 更新可视层（polyline + markers）
  route.polyline.setLatLngs(newPoints.map((p) => [p.lat, p.lon]));
  route.markers.forEach((m, i) => {
    m.setLatLng([newPoints[i].lat, newPoints[i].lon]);
  });
}

function enableAddMode() {
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
  pendingAdd = true;
  setStatus('点击地图以添加节点（追加到末尾）');
}

function onMapClick(e) {
  if (!pendingAdd) return;
  const { lat, lng } = e.latlng;
  const route = getRoute(selectedRouteId);
  if (!route || !route.visible || !route.editable) return;
  const idx = route.points.length;
  route.points.push({ lat, lon: lng, props: {}, seq: idx });
  const marker = createMarker({ routeId: route.id, idx, point: route.points[idx], color: route.color, editable: route.editable });
  route.markers.push(marker);
  route.polyline.addLatLng([lat, lng]);
  pendingAdd = false;
  setStatus('已添加节点到末尾');
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
  map.removeLayer(marker);
  route.markers.splice(pointIdx, 1);
  route.points.splice(pointIdx, 1);
  route.polyline.setLatLngs(route.points.map((p) => [p.lat, p.lon]));
  // 重新绑定索引
  route.markers.forEach((m, idx) => {
    m.off('click');
    m.off('dragstart');
    m.off('drag');
    m.off('dragend');

    m.on('dragstart', () => {
      const r = getRoute(routeId);
      if (!r) return;
      dragContext = {
        routeId,
        movedIdx: idx,
        originalPoints: r.points.map((p) => ({ lat: p.lat, lon: p.lon })),
        newPoints: null,
      };
    });

    m.on('drag', (e) => {
      const r = getRoute(routeId);
      if (!r) return;
      if (!dragContext || dragContext.routeId !== routeId) {
        return;
      }
      const { lat, lng } = e.target.getLatLng();
      smoothUpdatePoint(routeId, idx, lat, lng);
    });

    m.on('click', () => {
      selectRoute(routeId);
      selectMarker(routeId, idx);
    });

    m.on('dragend', (e) => {
      const r = getRoute(routeId);
      if (!r) return;
      const { lat, lng } = e.target.getLatLng();

      if (!dragContext || dragContext.routeId !== routeId) {
        updatePoint(routeId, idx, lat, lng);
        return;
      }

      smoothUpdatePoint(routeId, idx, lat, lng);

      if (dragContext.newPoints && dragContext.newPoints.length === r.points.length) {
        dragContext.newPoints.forEach((p, i) => {
          r.points[i].lat = p.lat;
          r.points[i].lon = p.lon;
        });
        setStatus(`节点已更新并联动平滑`);
      }

      dragContext = null;
    });
  });
  selectedPoint = null;
  setStatus('节点已删除');
}

function fitAllBounds() {
  const latlngs = routes
    .filter((r) => r.visible)
    .flatMap((r) => r.points.map((p) => [p.lat, p.lon]));
  if (!latlngs.length) return;
  const bounds = L.latLngBounds(latlngs);
  map.fitBounds(bounds, { padding: [20, 20] });
}

function exportCsv() {
  const visibleRoutes = routes.filter((r) => r.visible);
  if (!visibleRoutes.length) {
    setStatus('无可导出的可见航线');
    return;
  }
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
    const safeName = route.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `route_${rIdx + 1}`;
    saveAs(blob, `${safeName}-${stamp}.csv`);
  });
  setStatus(`已导出 ${visibleRoutes.length} 条可见航线`);
}
