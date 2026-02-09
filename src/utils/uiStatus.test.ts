/**
 * UI Status utilities tests
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('utils/uiStatus', () => {
  beforeEach(() => {
    // Create fresh DOM elements for each test
    document.body.innerHTML = '';
    const selectionEl = document.createElement('div');
    selectionEl.id = 'status-selection';
    document.body.appendChild(selectionEl);

    const coordsEl = document.createElement('div');
    coordsEl.id = 'status-coords';
    document.body.appendChild(coordsEl);
  });

  describe('setStatus', () => {
    it('should update status-selection element', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('Test message');

      const el = document.getElementById('status-selection');
      expect(el?.textContent).toBe('Test message');
    });

    it('should handle empty messages', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('');

      const el = document.getElementById('status-selection');
      expect(el?.textContent).toBe('');
    });

    it('should handle long messages', async () => {
      const { setStatus } = await import('./uiStatus');
      const longMessage = 'This is a very long status message that might cause overflow issues';

      setStatus(longMessage);

      const el = document.getElementById('status-selection');
      expect(el?.textContent).toBe(longMessage);
    });

    it('should handle Chinese characters', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('测试消息：航线已加载');

      const el = document.getElementById('status-selection');
      expect(el?.textContent).toBe('测试消息：航线已加载');
    });

    it('should handle Unicode emoji', async () => {
      const { setStatus } = await import('./uiStatus');

      setStatus('Status with emoji 🚀');

      const el = document.getElementById('status-selection');
      expect(el?.textContent).toBe('Status with emoji 🚀');
    });
  });

  describe('updateStatusCoords', () => {
    it('should format coordinates with 4 decimal places', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(30.12345, 120.67890);

      const el = document.getElementById('status-coords');
      expect(el?.textContent).toBe('30.1234, 120.6789');
    });

    it('should handle negative coordinates', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(-30.5, -120.25);

      const el = document.getElementById('status-coords');
      expect(el?.textContent).toBe('-30.5000, -120.2500');
    });

    it('should handle zero coordinates', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(0, 0);

      const el = document.getElementById('status-coords');
      expect(el?.textContent).toBe('0.0000, 0.0000');
    });

    it('should handle large decimal values', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(89.999999, 179.999999);

      const el = document.getElementById('status-coords');
      expect(el?.textContent).toBe('90.0000, 180.0000');
    });

    it('should handle very small decimal values', async () => {
      const { updateStatusCoords } = await import('./uiStatus');

      updateStatusCoords(0.00001, 0.00001);

      const el = document.getElementById('status-coords');
      expect(el?.textContent).toBe('0.0000, 0.0000');
    });
  });

  describe('DOM element absence', () => {
    it('setStatus should not throw when element is missing', async () => {
      document.body.innerHTML = '';
      const { setStatus } = await import('./uiStatus');

      expect(() => setStatus('test')).not.toThrow();
    });

    it('updateStatusCoords should not throw when element is missing', async () => {
      document.body.innerHTML = '';
      const { updateStatusCoords } = await import('./uiStatus');

      expect(() => updateStatusCoords(30, 120)).not.toThrow();
    });
  });
});
