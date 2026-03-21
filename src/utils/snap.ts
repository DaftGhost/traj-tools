/**
 * Unified snap utilities for snapping to routes
 */

import { store, type Point, isPolygonRoute } from '../state/store';
import type { SnapRef, SnapResult } from '../types/refs';
import { haversineDistance } from './geo';
import { MEASURE_CONFIG } from '../config/constants';
import * as L from 'leaflet';

/**
 * Calculate distance between two points (meters)
 */
export function distanceMeters(p1: Point, p2: Point): number {
  return haversineDistance(p1, p2);
}

/**
 * Calculate squared distance from point to line segment (in degree coordinates)
 */
export function sqSegDist(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    return (point.lon - lineStart.lon) ** 2 + (point.lat - lineStart.lat) ** 2;
  }

  const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) /
    (dx * dx + dy * dy);

  if (t < 0) {
    return (point.lon - lineStart.lon) ** 2 + (point.lat - lineStart.lat) ** 2;
  } else if (t > 1) {
    return (point.lon - lineEnd.lon) ** 2 + (point.lat - lineEnd.lat) ** 2;
  }

  const nearest = {
    lon: lineStart.lon + t * dx,
    lat: lineStart.lat + t * dy
  };

  return (point.lon - nearest.lon) ** 2 + (point.lat - nearest.lat) ** 2;
}

/**
 * Calculate distance from point to line segment (in meters)
 */
export function pointToSegmentDistance(lat: number, lon: number, segStart: Point, segEnd: Point): number {
  const dx = segEnd.lon - segStart.lon;
  const dy = segEnd.lat - segStart.lat;

  if (dx === 0 && dy === 0) {
    return haversineDistance({ lat, lon }, segStart);
  }

  const t = ((lon - segStart.lon) * dx + (lat - segStart.lat) * dy) / (dx * dx + dy * dy);

  if (t < 0) {
    return haversineDistance({ lat, lon }, segStart);
  } else if (t > 1) {
    return haversineDistance({ lat, lon }, segEnd);
  }

  const nearest = {
    lat: segStart.lat + t * dy,
    lon: segStart.lon + t * dx
  };

  return haversineDistance({ lat, lon }, nearest);
}

/**
 * Get route segments for snapping
 */
export function getSnapGeometry(routeId?: string, useOriginal: boolean = false): Array<{ start: Point; end: Point; routeId: string; pointIdx: number; ringIndex?: number }> {
  const routes = routeId
    ? [store.getRouteById(routeId)].filter((r): r is NonNullable<typeof r> => r != null && r.visible)
    : store.routes.filter(r => r.visible);

  const segments: Array<{ start: Point; end: Point; routeId: string; pointIdx: number; ringIndex?: number }> = [];

  for (const route of routes) {
    const rings = useOriginal || route.editable
      ? [route.points, ...(route.holes ?? [])]
      : [route._display?.simplified ?? route.points, ...(route._display?.holes ?? route.holes ?? [])];
    const closed = isPolygonRoute(route);

    rings.forEach((points, ringIndex) => {
      if (points.length < 2) return;

      const segmentCount = closed ? points.length : points.length - 1;
      for (let i = 0; i < segmentCount; i++) {
        const nextIdx = closed ? (i + 1) % points.length : i + 1;
        if (!points[i] || !points[nextIdx]) continue;

        segments.push({
          start: points[i],
          end: points[nextIdx],
          routeId: route.id,
          pointIdx: i,
          ringIndex: closed ? ringIndex : undefined,
        });
      }
    });
  }

  return segments;
}

/**
 * Find nearest route vertex
 */
export function findNearestVertex(
  latlng: L.LatLng,
  routeId?: string
): { point: Point; routeId: string; index: number; ringIndex?: number } | null {
  const routes = routeId
    ? [store.getRouteById(routeId)].filter((r): r is NonNullable<typeof r> => r != null && r.visible)
    : store.routes.filter(r => r.visible);
  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  let minDist = Infinity;
  let result: { point: Point; routeId: string; index: number; ringIndex?: number } | null = null;

  for (const route of routes) {
    const rings = [route.points, ...(route.holes ?? [])];

    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
      const ring = rings[ringIndex];
      for (let i = 0; i < ring.length; i++) {
        const point = ring[i];
        const dist = haversineDistance(target, point);
        if (dist < minDist) {
          minDist = dist;
          result = {
            point,
            routeId: route.id,
            index: i,
            ringIndex: isPolygonRoute(route) ? ringIndex : undefined,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Snap to nearest route point or segment
 */
export function snapToRoutes(latlng: L.LatLng, snapSelectedOnly: boolean = false, useOriginal: boolean = false): SnapResult | null {
  if (!store.map) return null;

  const target: Point = { lat: latlng.lat, lon: latlng.lng };
  const selectedRouteId = snapSelectedOnly ? store.selectedRouteId || undefined : undefined;
  const snapGeometry = getSnapGeometry(selectedRouteId, useOriginal);

  if (snapGeometry.length === 0) return null;

  // 1. Find nearest vertex first
  const nearestVertex = findNearestVertex(latlng, selectedRouteId);

  // 2. Find nearest segment
  let minSegDist = Infinity;
  let nearestSegment: { start: Point; end: Point; routeId: string; pointIdx: number; ringIndex?: number } | null = null;
  let nearestPointOnSegment: Point | null = null;

  for (let i = 0; i < snapGeometry.length; i++) {
    const seg = snapGeometry[i];
    const dist = sqSegDist(target, seg.start, seg.end);
    if (dist < minSegDist) {
      minSegDist = dist;
      nearestSegment = seg;

      // Calculate nearest point
      const dx = seg.end.lon - seg.start.lon;
      const dy = seg.end.lat - seg.start.lat;
      const t = ((target.lon - seg.start.lon) * dx + (target.lat - seg.start.lat) * dy) /
        (dx * dx + dy * dy);
      const tClamped = Math.max(0, Math.min(1, t));
      nearestPointOnSegment = {
        lon: seg.start.lon + tClamped * dx,
        lat: seg.start.lat + tClamped * dy
      };
    }
  }

  // Convert threshold to meters for comparison
  const mapZoom = store.map.getZoom();
  const metersPerPx = 156543.0332 * Math.cos(latlng.lat * Math.PI / 180) / Math.pow(2, mapZoom);
  const snapThresholdMeters = MEASURE_CONFIG.snapThresholdPx * metersPerPx;

  // Priority check: vertex
  if (nearestVertex) {
    const vertexDist = haversineDistance(target, nearestVertex.point);
    if (vertexDist < snapThresholdMeters) {
      return {
        lat: nearestVertex.point.lat,
        lon: nearestVertex.point.lon,
        ref: {
          routeId: nearestVertex.routeId,
          ringIndex: nearestVertex.ringIndex,
          segIdx: nearestVertex.index,
          segFrac: 0,
        }
      };
    }
  }

  // Check segment
  if (nearestSegment && nearestPointOnSegment) {
    const distToSegment = haversineDistance(target, nearestPointOnSegment);
    if (distToSegment < snapThresholdMeters) {
      // Calculate segFrac
      const dx = nearestSegment.end.lon - nearestSegment.start.lon;
      const dy = nearestSegment.end.lat - nearestSegment.start.lat;
      const t = dx !== 0 || dy !== 0
        ? ((nearestPointOnSegment.lon - nearestSegment.start.lon) * dx + (nearestPointOnSegment.lat - nearestSegment.start.lat) * dy) /
          (dx * dx + dy * dy)
        : 0;

      return {
        lat: nearestPointOnSegment.lat,
        lon: nearestPointOnSegment.lon,
        ref: {
          routeId: nearestSegment.routeId,
          ringIndex: nearestSegment.ringIndex,
          segIdx: nearestSegment.pointIdx,
          segFrac: Math.max(0, Math.min(1, t)),
        }
      };
    }
  }

  return null;
}
