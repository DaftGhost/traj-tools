/**
 * 标记图标工具模块
 * 使用 L.divIcon 创建可自定义的标记图标
 */

import * as L from 'leaflet';

/**
 * 创建航线标记图标
 * @param color 标记边框颜色
 * @param selected 是否选中状态（选中时显示阴影效果）
 * @returns L.DivIcon 实例
 */
export function buildMarkerIcon(color: string, selected: boolean = false): L.DivIcon {
  const size = selected ? 16 : 14;
  const border = selected ? 3 : 2;
  const radius = size / 2;

  return L.divIcon({
    className: 'route-marker',
    html: `<span style="
      display: block;
      width: ${size}px;
      height: ${size}px;
      border: ${border}px solid ${color};
      border-radius: ${radius}px;
      background: #fff;
      box-sizing: border-box;
      box-shadow: ${selected ? '0 0 6px #2563eb' : 'none'};
    "></span>`,
    iconSize: [size, size],
    iconAnchor: [radius, radius],
  });
}
