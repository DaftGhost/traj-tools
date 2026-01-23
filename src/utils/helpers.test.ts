/**
 * 辅助函数测试
 */

import { describe, it, expect } from 'vitest';
import { swapLeftRight } from './helpers';

describe('swapLeftRight', () => {
  it('should swap English "left" to "right"', () => {
    expect(swapLeftRight('road_left')).toBe('road_right');
    expect(swapLeftRight('left_lane')).toBe('right_lane');
    expect(swapLeftRight('turn_left')).toBe('turn_right');
  });

  it('should swap English "right" to "left"', () => {
    expect(swapLeftRight('road_right')).toBe('road_left');
    expect(swapLeftRight('right_lane')).toBe('left_lane');
    expect(swapLeftRight('turn_right')).toBe('turn_left');
  });

  it('should preserve case for English words', () => {
    expect(swapLeftRight('Left')).toBe('Right');
    expect(swapLeftRight('RIGHT')).toBe('LEFT');
    expect(swapLeftRight('Road_LEFT')).toBe('Road_RIGHT');
  });

  it('should swap Chinese "左" to "右"', () => {
    expect(swapLeftRight('道路_左')).toBe('道路_右');
    expect(swapLeftRight('左转')).toBe('右转');
    expect(swapLeftRight('左侧车道')).toBe('右侧车道');
  });

  it('should swap Chinese "右" to "左"', () => {
    expect(swapLeftRight('道路_右')).toBe('道路_左');
    expect(swapLeftRight('右转')).toBe('左转');
    expect(swapLeftRight('右侧车道')).toBe('左侧车道');
  });

  it('should handle mixed English and Chinese', () => {
    expect(swapLeftRight('left_道路_右')).toBe('right_道路_左');
    expect(swapLeftRight('左_lane_right')).toBe('右_lane_left');
  });

  it('should swap multiple occurrences', () => {
    expect(swapLeftRight('left_left_left')).toBe('right_right_right');
    expect(swapLeftRight('右转后左转')).toBe('左转后右转');
  });

  it('should not change strings without left/right', () => {
    expect(swapLeftRight('N_S_route')).toBe('N_S_route');
    expect(swapLeftRight('center_lane')).toBe('center_lane');
    expect(swapLeftRight('道路_中间')).toBe('道路_中间');
  });

  it('should handle empty strings', () => {
    expect(swapLeftRight('')).toBe('');
  });

  it('should handle complex filenames', () => {
    expect(swapLeftRight('N_S_highway_left_1-100')).toBe('N_S_highway_right_1-100');
    expect(swapLeftRight('东西向_右侧_主干道')).toBe('东西向_左侧_主干道');
  });
});
