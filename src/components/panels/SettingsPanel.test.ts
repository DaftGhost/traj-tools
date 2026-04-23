/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPanel from './SettingsPanel.vue';
import { store } from '../../state/store';

const { refreshAllRouteDisplayGeometry } = vi.hoisted(() => ({
  refreshAllRouteDisplayGeometry: vi.fn(),
}));

vi.mock('../../routes/geometry', () => ({
  refreshAllRouteDisplayGeometry,
}));

describe('SettingsPanel', () => {
  beforeEach(() => {
    store.uiState.showOriginalRouteGeometry = false;
    refreshAllRouteDisplayGeometry.mockClear();
  });

  it('reflects the stored original-geometry toggle state on mount', async () => {
    store.uiState.showOriginalRouteGeometry = true;

    const wrapper = mount(SettingsPanel);
    await nextTick();
    const checkbox = wrapper.findAll('input[type="checkbox"]')[0];

    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
  });

  it('updates the store flag and refreshes visible route geometry when toggled', async () => {
    const wrapper = mount(SettingsPanel);
    const checkbox = wrapper.findAll('input[type="checkbox"]')[0];

    await checkbox.setValue(true);

    expect(store.uiState.showOriginalRouteGeometry).toBe(true);
    expect(refreshAllRouteDisplayGeometry).toHaveBeenCalledTimes(1);
  });
});
