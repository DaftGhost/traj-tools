/**
 * 导出模块测试
 */

import { describe, it, expect } from 'vitest';
import { swapLeftRight } from '../utils/helpers';

// Test the swapLeftRight function is working correctly in export context
describe('Export with left/right swapping', () => {
  it('should swap left/right in route names for reversed routes', () => {
    // Test baseName swapping
    expect(swapLeftRight('highway_left')).toBe('highway_right');
    expect(swapLeftRight('highway_right')).toBe('highway_left');
    expect(swapLeftRight('道路_左')).toBe('道路_右');
    expect(swapLeftRight('道路_右')).toBe('道路_左');
  });

  it('should swap left/right in prefix for reversed routes', () => {
    // Test prefix swapping (like segment ranges)
    expect(swapLeftRight('1-100_left')).toBe('1-100_right');
    expect(swapLeftRight('left_lane_50-150')).toBe('right_lane_50-150');
  });

  it('should handle complex route names', () => {
    // Test realistic route names
    expect(swapLeftRight('N_S_highway_left_lane')).toBe('N_S_highway_right_lane');
    expect(swapLeftRight('东西向_左侧_车道')).toBe('东西向_右侧_车道');
    expect(swapLeftRight('Left_Turn_Route')).toBe('Right_Turn_Route');
  });

  it('should not modify routes without left/right', () => {
    expect(swapLeftRight('N_S_highway')).toBe('N_S_highway');
    expect(swapLeftRight('center_lane')).toBe('center_lane');
    expect(swapLeftRight('1-100')).toBe('1-100');
  });

  it('should handle empty strings and prefixes', () => {
    expect(swapLeftRight('')).toBe('');
    expect(swapLeftRight('1-100')).toBe('1-100');
  });
});

// Integration test concept (would need DOM mocking for full test)
describe('Export filename generation', () => {
  it('should generate correct forward and reverse filenames', () => {
    const baseName = 'highway_left';
    const prefix = '1-100';
    const direction = 'S';
    const reverseDirection = 'N';

    // Forward file
    const forwardName = `${reverseDirection}_${direction}_${baseName}_${prefix}`;
    expect(forwardName).toBe('N_S_highway_left_1-100');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`;
    expect(reverseName).toBe('S_N_highway_right_1-100');
  });

  it('should generate correct filenames for Chinese routes', () => {
    const baseName = '公路_左侧';
    const prefix = '路段_1';
    const direction = 'E';
    const reverseDirection = 'W';

    // Forward file
    const forwardName = `${reverseDirection}_${direction}_${baseName}_${prefix}`;
    expect(forwardName).toBe('W_E_公路_左侧_路段_1');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}`;
    expect(reverseName).toBe('E_W_公路_右侧_路段_1');
  });

  it('should handle routes without prefix', () => {
    const baseName = 'highway_right';
    const prefix = '';
    const direction = 'N';
    const reverseDirection = 'S';

    // Forward file
    const forwardName = prefix ? `${reverseDirection}_${direction}_${baseName}_${prefix}` : `${reverseDirection}_${direction}_${baseName}`;
    expect(forwardName).toBe('S_N_highway_right');

    // Reverse file (with swapping)
    const reverseBaseName = swapLeftRight(baseName);
    const reversePrefix = swapLeftRight(prefix);
    const reverseName = reversePrefix ? `${direction}_${reverseDirection}_${reverseBaseName}_${reversePrefix}` : `${direction}_${reverseDirection}_${reverseBaseName}`;
    expect(reverseName).toBe('N_S_highway_left');
  });
});
