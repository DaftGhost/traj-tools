/**
 * 常量配置模块
 * 包含所有可配置的参数
 */

// 天地图 API 密钥配置已移至环境变量
// 本地开发: 在 .env 文件中配置 VITE_TIANDITU_API_KEY
// Cloudflare Pages: 在 Pages 设置中添加环境变量 TIANDITU_API_KEY

// 颜色调色板
export const PALETTE = [
  '#E53935', // Red
  '#D81B60', // Pink
  '#8E24AA', // Purple
  '#5E35B1', // Deep Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#039BE5', // Light Blue
  '#00ACC1', // Cyan
  '#00897B', // Teal
  '#43A047', // Green
  '#7CB342', // Light Green
  '#C0CA33', // Lime
  '#FDD835', // Yellow
  '#FFB300', // Amber
  '#FB8C00', // Orange
  '#F4511E', // Deep Orange
];

const DEFAULT_SIMPLIFY_RETAIN_RATIO = 0.1;
const MIN_SIMPLIFY_RETAIN_RATIO = 0.01;
const MAX_SIMPLIFY_RETAIN_RATIO = 1;

function parseSimplifyRetainRatio(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_SIMPLIFY_RETAIN_RATIO;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SIMPLIFY_RETAIN_RATIO;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SIMPLIFY_RETAIN_RATIO;
  }

  return Math.min(MAX_SIMPLIFY_RETAIN_RATIO, Math.max(MIN_SIMPLIFY_RETAIN_RATIO, parsed));
}

// 轨迹简化配置
export const SIMPLIFY_CONFIG = {
  /**
   * Visvalingam-Whyatt 保点比例（与缩放级别无关）
   */
  retainRatio: parseSimplifyRetainRatio(import.meta.env.VITE_SIMPLIFY_RETAIN_RATIO),
  /**
   * 保留 Douglas-Peucker 容差配置作为兜底
   */
  tolerancePxForZoom(zoom: number): number {
    if (zoom >= 15) return 0;
    if (zoom >= 14) return 0.001;
    if (zoom >= 13) return 0.002;
    if (zoom >= 12) return 0.005;
    if (zoom >= 10) return 0.01;
    if (zoom >= 8) return 0.05;
    if (zoom >= 6) return 0.1;
    return 0.5;
  },
  minPoints: 2,
};

// 平滑配置
export const SMOOTH_CONFIG = {
  radiusMeters: 20, // 默认平滑半径（米）
  minRadius: 1,
  maxRadius: 10000,
};

// 热力图配置
export const HEATMAP_CONFIG = {
  defaultRadius: 25,
  defaultBlur: 15,
  defaultOpacity: 0.1,
  gradients: {
    default: { 0.4: 'blue', 0.6: 'lime', 0.7: 'yellow', 0.8: 'orange', 1.0: 'red' },
    fire: { 0.1: 'yellow', 0.3: 'orange', 0.5: 'red', 0.7: 'darkred', 1.0: 'black' },
    cold: { 0.1: 'blue', 0.3: 'cyan', 0.5: 'white', 0.7: 'lightgray', 1.0: 'gray' },
    grayscale: { 0.1: 'white', 0.4: 'lightgray', 0.7: 'gray', 1.0: 'black' },
  },
};

// 测距工具配置
export const MEASURE_CONFIG = {
  snapThresholdPx: 12, // 吸附阈值（像素）
  minDistanceMeters: 0.001, // 最小显示距离
};

// 片段截取配置
export const SEGMENT_EXPORT_CONFIG = {
  defaultSearchRadius: 50, // 搜索半径（米）
  minSearchRadius: 1,
  maxSearchRadius: 200,
};

// 版本号
export const VERSION = '2.1.0';
