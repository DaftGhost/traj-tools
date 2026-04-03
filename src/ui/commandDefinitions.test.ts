/**
 * Command definitions tests
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';

describe('ui/commandDefinitions', () => {
  describe('getCommands', () => {
    it('should return an array of commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should have unique command IDs', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const ids = commands.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have required properties for each command', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();

      commands.forEach((cmd) => {
        expect(cmd.id).toBeDefined();
        expect(typeof cmd.id).toBe('string');
        expect(cmd.name).toBeDefined();
        expect(typeof cmd.name).toBe('string');
        expect(typeof cmd.action).toBe('function');
        expect(cmd.category).toBeDefined();
        expect(typeof cmd.category).toBe('string');
      });
    });

    it('should have commands in expected categories', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const categories = new Set(commands.map((c) => c.category));

      expect(categories.has('文件')).toBe(true);
      expect(categories.has('视图')).toBe(true);
      expect(categories.has('底图')).toBe(true);
      expect(categories.has('编辑')).toBe(true);
      expect(categories.has('工具')).toBe(true);
    });

    it('should have file import command', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const importCmd = commands.find((c) => c.id === 'file.import');

      expect(importCmd).toBeDefined();
      expect(importCmd?.name).toBe('导入文件');
      expect(importCmd?.description).toBe('导入 CSV 文件');
    });

    it('should have file export commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const exportCmd = commands.find((c) => c.id === 'file.export');
      const exportSegmentCmd = commands.find(
        (c) => c.id === 'file.exportSegment'
      );

      expect(exportCmd).toBeDefined();
      expect(exportSegmentCmd).toBeDefined();
    });

    it('should have view commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const fitAllCmd = commands.find((c) => c.id === 'view.fitAll');
      const zoomInCmd = commands.find((c) => c.id === 'view.zoomIn');
      const zoomOutCmd = commands.find((c) => c.id === 'view.zoomOut');

      expect(fitAllCmd).toBeDefined();
      expect(fitAllCmd?.name).toBe('显示全部航线');
      expect(zoomInCmd).toBeDefined();
      expect(zoomInCmd?.name).toBe('放大');
      expect(zoomOutCmd).toBeDefined();
      expect(zoomOutCmd?.name).toBe('缩小');
    });

    it('should have all base layer commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const baseLayerCmds = commands.filter((c) => c.id.startsWith('map.'));

      expect(baseLayerCmds.length).toBe(4);
      expect(baseLayerCmds.some((c) => c.name.includes('OpenStreetMap'))).toBe(
        true
      );
      expect(baseLayerCmds.some((c) => c.name.includes('卫星图'))).toBe(true);
      expect(baseLayerCmds.some((c) => c.name.includes('暗色地图'))).toBe(true);
      expect(baseLayerCmds.some((c) => c.name.includes('浅色地图'))).toBe(true);
    });

    it('should have edit commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const toggleModeCmd = commands.find((c) => c.id === 'edit.toggleMode');
      const deleteCmd = commands.find((c) => c.id === 'edit.deleteSelected');
      const mergeCmd = commands.find((c) => c.id === 'edit.mergeRoutes');

      expect(toggleModeCmd).toBeDefined();
      expect(toggleModeCmd?.name).toBe('切换编辑模式');
      expect(deleteCmd).toBeDefined();
      expect(deleteCmd?.name).toBe('删除选中节点');
      expect(mergeCmd).toBeDefined();
      expect(mergeCmd?.name).toBe('合并航线');
    });

    it('should have tool commands', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const measureCmd = commands.find((c) => c.id === 'tools.toggleMeasure');
      const segmentCmd = commands.find((c) => c.id === 'tools.toggleSegment');
      const heatmapCmd = commands.find((c) => c.id === 'tools.toggleHeatmap');

      expect(measureCmd).toBeDefined();
      expect(measureCmd?.name).toBe('切换测距工具');
      expect(segmentCmd).toBeDefined();
      expect(segmentCmd?.name).toBe('切换航段导出模式');
      expect(heatmapCmd).toBeDefined();
      expect(heatmapCmd?.name).toBe('切换热力图');
    });
  });

  describe('CommandItem interface', () => {
    it('should accept valid command with all fields', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const fullCmd = commands.find((c) => c.description !== undefined);

      expect(fullCmd).toBeDefined();
      expect(fullCmd!.id).toBeDefined();
      expect(fullCmd!.name).toBeDefined();
      expect(fullCmd!.description).toBeDefined();
      expect(fullCmd!.action).toBeDefined();
      expect(fullCmd!.category).toBeDefined();
    });

    it('should accept commands without description', async () => {
      const { getCommands } = await import('./commandDefinitions');

      const commands = getCommands();
      const noDescCmd = commands.find((c) => c.description === undefined);

      expect(noDescCmd).toBeDefined();
      expect(noDescCmd!.id).toBeDefined();
      expect(noDescCmd!.name).toBeDefined();
      expect(noDescCmd!.action).toBeDefined();
      expect(noDescCmd!.category).toBeDefined();
    });
  });
});
