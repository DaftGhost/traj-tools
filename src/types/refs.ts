/**
 * Unified reference types for snap operations
 */

/**
 * Reference to a point on a route segment
 */
export interface SnapRef {
  routeId: string;
  /** Ring index for polygons (0 = outer ring, 1+ = holes) */
  ringIndex?: number;
  /** Segment index (the index of the starting point of the segment) */
  segIdx: number;
  /** Position within the segment (0-1, 0 = at segIdx point, 1 = at segIdx+1 point) */
  segFrac: number;
}

/**
 * Result of a snap operation
 */
export interface SnapResult {
  lat: number;
  lon: number;
  ref: SnapRef | null;
}
