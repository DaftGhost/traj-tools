/**
 * Unified UI status utilities
 * Consolidates setStatus and updateStatusCoords functions
 */

/**
 * Update status bar selection message
 */
export function setStatus(message: string): void {
  const el = document.getElementById('status-selection');
  if (el) {
    el.textContent = message;
  }
}

/**
 * Update status bar coordinates display
 */
export function updateStatusCoords(lat: number, lon: number): void {
  const el = document.getElementById('status-coords');
  if (el) {
    el.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
