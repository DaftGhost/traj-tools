/**
 * 状态管理单例
 * 集中管理应用的所有状态
 */

import { PALETTE } from '../config/constants';
import type * as Leaflet from 'leaflet';

// ============================================
// 类型定义
// ============================================

export interface Point {
  lat: number;
  lon: number;
}

export type GeometryType = 'polyline' | 'polygon';

export interface HeatmapOptions {
  radius: number;
  blur: number;
  minOpacity: number;
  gradient: 'default' | 'fire' | 'cold' | 'grayscale';
}

export interface Route {
  id: string;
  name: string;
  points: Point[];
  geometryType?: GeometryType;
  holes?: Point[][];
  color: string;
  editable: boolean;
  visible: boolean;
  selected: boolean;
  _display?: {
    simplified: Point[];
    holes?: Point[][];
    layer: Leaflet.Polyline | Leaflet.Polygon | null;
    markers: Leaflet.Marker[];
  };
  /** 累计距离缓存: Map<pointIndex, cumulativeDistanceInMeters> */
  _distCache?: number[];
  /** 孔洞累计距离缓存 */
  _holeDistCaches?: number[][];
  /** 热力图层 */
  heatLayer?: Leaflet.Layer | null;
  /** 是否启用热力图 */
  heatEnabled?: boolean;
  /** 热力图选项 */
  heatOptions?: HeatmapOptions;
}

export interface UIState {
  activePanel:
    | 'files'
    | 'edit'
    | 'measure'
    | 'heatmap'
    | 'export'
    | 'settings'
    | 'help';
  propertiesPanelCollapsed: boolean;
  sideBarCollapsed: boolean;
  routeSearchQuery: string;
}

export interface EditHandle {
  routeId: string;
  pointIdx: number;
  ringIndex?: number;
  marker: Leaflet.Marker;
}

export interface MeasureState {
  active: boolean;
  points: Point[];
  hover: Point | null;
  layer: Leaflet.Polyline | null;
}

export interface SegmentExportState {
  active: boolean;
  startPoint: Point | null;
  endPoint: Point | null;
  searchRadius: number;
  layer: Leaflet.LayerGroup | null;
}

export interface HeatmapState {
  enabled: boolean;
  layer: Leaflet.Layer | null;
  /** 开启热力图时隐藏航线 */
  hideRoute: boolean;
  options: {
    radius: number;
    blur: number;
    opacity: number;
    gradient: 'default' | 'fire' | 'cold' | 'grayscale';
  };
}

/** 平滑拖拽项 */
export interface SmoothDragItem {
  idx: number;
  w: number;
  lat0: number;
  lon0: number;
}

/** 平滑拖拽上下文 */
export interface SmoothDragContext {
  routeId: string;
  movedIdx: number;
  ringIndex?: number;
  /** 累积位移，用于增量计算 */
  accumulatedDelta: { lat: number; lon: number };
  items: SmoothDragItem[];
}

export function getRouteGeometryType(
  route: Pick<Route, 'geometryType'>
): GeometryType {
  return route.geometryType === 'polygon' ? 'polygon' : 'polyline';
}

export function isPolygonRoute(route: Pick<Route, 'geometryType'>): boolean {
  return getRouteGeometryType(route) === 'polygon';
}

export function getPointsForRing(
  route: Pick<Route, 'points' | 'holes'>,
  ringIndex: number = 0
): Point[] {
  if (ringIndex <= 0) {
    return route.points;
  }

  return route.holes?.[ringIndex - 1] ?? [];
}

export function setPointsForRing(
  route: Route,
  ringIndex: number,
  points: Point[]
): void {
  if (ringIndex <= 0) {
    route.points = points;
    return;
  }

  if (!route.holes) {
    route.holes = [];
  }

  route.holes[ringIndex - 1] = points;
}

export function getRouteRings(
  route: Pick<Route, 'points' | 'holes' | 'geometryType'>
): Point[][] {
  if (!isPolygonRoute(route)) {
    return [route.points];
  }

  return [route.points, ...(route.holes ?? [])];
}

export function getRouteVertexCount(
  route: Pick<Route, 'points' | 'holes' | 'geometryType'>
): number {
  return getRouteRings(route).reduce((total, ring) => total + ring.length, 0);
}

// ============================================
// 状态存储类
// ============================================

class StateStore {
  // 核心状态
  routes: Route[] = [];
  selectedRouteId: string | null = null;
  selectedPoint: {
    routeId: string;
    pointIdx: number;
    ringIndex?: number;
  } | null = null;
  editHandle: EditHandle | null = null;
  dragContext: { startLat: number; startLon: number } | null = null;

  // UI 状态
  uiState: UIState = {
    activePanel: 'files',
    propertiesPanelCollapsed: false,
    sideBarCollapsed: false,
    routeSearchQuery: '',
  };

  // 工具状态
  measure: MeasureState = {
    active: false,
    points: [],
    hover: null,
    layer: null,
  };

  segmentExport: SegmentExportState = {
    active: false,
    startPoint: null,
    endPoint: null,
    searchRadius: 50,
    layer: null,
  };

  heatmap: HeatmapState = {
    enabled: false,
    layer: null,
    hideRoute: false,
    options: {
      radius: 25,
      blur: 15,
      opacity: 0.1,
      gradient: 'default',
    },
  };

  // 平滑半径（米）
  smoothRadius = 20;

  // 地图实例
  map: Leaflet.Map | null = null;

  // 颜色调色板索引
  private colorIndex = 0;

  // ============================================
  // 路由管理方法
  // ============================================

  getNextColor(): string {
    const color = PALETTE[this.colorIndex % PALETTE.length];
    this.colorIndex++;
    return color;
  }

  resetColorIndex(): void {
    this.colorIndex = 0;
  }

  getRouteById(id: string): Route | undefined {
    return this.routes.find((r) => r.id === id);
  }

  getSelectedRoute(): Route | undefined {
    return this.selectedRouteId
      ? this.getRouteById(this.selectedRouteId)
      : undefined;
  }

  addRoute(
    name: string,
    points: Point[],
    options: {
      geometryType?: GeometryType;
      holes?: Point[][];
    } = {}
  ): Route {
    const route: Route = {
      id: crypto.randomUUID(),
      name,
      points,
      geometryType: options.geometryType ?? 'polyline',
      holes:
        options.holes?.map((ring) => ring.map((point) => ({ ...point }))) ?? [],
      color: this.getNextColor(),
      editable: false,
      visible: true,
      selected: false,
    };
    this.routes.push(route);
    return route;
  }

  removeRoute(id: string): void {
    const idx = this.routes.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.routes.splice(idx, 1);
      if (this.selectedRouteId === id) {
        this.selectedRouteId = null;
      }
    }
  }

  // ============================================
  // 选择状态方法
  // ============================================

  selectRoute(id: string | null): void {
    this.routes.forEach((r) => (r.selected = r.id === id));
    this.selectedRouteId = id;
    this.selectedPoint = null;
    this.clearEditHandle();
  }

  selectPoint(routeId: string, pointIdx: number, ringIndex?: number): void {
    this.selectedPoint =
      ringIndex !== undefined
        ? { routeId, pointIdx, ringIndex }
        : { routeId, pointIdx };
  }

  clearSelection(): void {
    this.selectRoute(null);
    this.selectedPoint = null;
  }

  // ============================================
  // 编辑句柄方法
  // ============================================

  setEditHandle(
    routeId: string,
    pointIdx: number,
    marker: Leaflet.Marker,
    ringIndex?: number
  ): void {
    this.editHandle =
      ringIndex !== undefined
        ? { routeId, pointIdx, marker, ringIndex }
        : { routeId, pointIdx, marker };
  }

  clearEditHandle(): void {
    if (this.editHandle) {
      this.editHandle = null;
    }
  }

  // ============================================
  // 统计方法
  // ============================================

  getTotalPoints(): number {
    return this.routes.reduce(
      (sum, route) => sum + getRouteVertexCount(route),
      0
    );
  }

  getVisibleRouteCount(): number {
    return this.routes.filter((r) => r.visible).length;
  }
}

// 导出单例实例
export const store = new StateStore();
