/**
 * UI Status utilities tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetViewBridgeStateForTests, uiViewState } from '../ui/viewBridge';

describe('utils/uiStatus', () => {
  beforeEach(() => {
    resetViewBridgeStateForTests();
  });

  describe('setStatus', () => {
    it('should update the bridge status message', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('Test message');

      expect(uiViewState.statusMessage).toBe('Test message');
    });

    it('should handle empty messages', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('');

      expect(uiViewState.statusMessage).toBe('');
    });

    it('should handle long messages', async () => {
      const { setStatus } = await import('./uiStatus');
      const longMessage =
        'This is a very long status message that might cause overflow issues';

      setStatus(longMessage);

      expect(uiViewState.statusMessage).toBe(longMessage);
    });

    it('should handle Chinese characters', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('测试消息：航线已加载');

      expect(uiViewState.statusMessage).toBe('测试消息：航线已加载');
    });

    it('should handle Unicode emoji', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('Status with emoji 🚀');

      expect(uiViewState.statusMessage).toBe('Status with emoji 🚀');
    });
  });

  describe('updateStatusCoords', () => {
    it('should format coordinates with 4 decimal places', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(30.12345, 120.6789);

      expect(uiViewState.coordsText).toBe('30.1234, 120.6789');
    });

    it('should handle negative coordinates', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(-30.5, -120.25);

      expect(uiViewState.coordsText).toBe('-30.5000, -120.2500');
    });

    it('should handle zero coordinates', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(0, 0);

      expect(uiViewState.coordsText).toBe('0.0000, 0.0000');
    });

    it('should handle large decimal values', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(89.999999, 179.999999);

      expect(uiViewState.coordsText).toBe('90.0000, 180.0000');
    });

    it('should handle very small decimal values', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(0.00001, 0.00001);

      expect(uiViewState.coordsText).toBe('0.0000, 0.0000');
    });
  });

  describe('bridge updates', () => {
    it('setStatus should not depend on DOM elements', async () => {
      const { setStatus } = await import('./uiStatus');

      expect(() => setStatus('test')).not.toThrow();
      expect(uiViewState.statusMessage).toBe('test');
    });

    it('updateStatusCoords should not depend on DOM elements', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      expect(() => updateStatusCoords(30, 120)).not.toThrow();
      expect(uiViewState.coordsText).toBe('30.0000, 120.0000');
    });
  });
});
