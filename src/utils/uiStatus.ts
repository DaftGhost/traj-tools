/**
 * Unified UI status utilities
 * Consolidates setStatus and updateStatusCoords functions
 */

import { setStatusMessage, updateStatusCoordsText } from '../ui/viewBridge';

export function setStatus(message: string): void {
  setStatusMessage(message);
}

export function updateStatusCoords(lat: number, lon: number): void {
  updateStatusCoordsText(lat, lon);
}
