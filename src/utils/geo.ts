/**
 * 地理计算工具函数
 */

import type { Point } from '../state/store';

/**
 * 计算两点之间的 Haversine 距离（米）
 */
export function haversineDistance(p1: Point, p2: Point): number {
  const R = 6371000;
  const dLat = toRad(p2.lat - p1.lat);
  let lonDiff = p2.lon - p1.lon;
  if (lonDiff > 180) lonDiff -= 360;
  else if (lonDiff < -180) lonDiff += 360;
  const dLon = toRad(lonDiff);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.lat === b.lat && a.lon === b.lon;
}

export function closeRing(points: Point[]): Point[] {
  if (points.length === 0) return [];

  const closed = points.map((point) => ({ ...point }));
  const first = closed[0];
  const last = closed[closed.length - 1];

  if (!pointsEqual(first, last)) {
    closed.push({ ...first });
  }

  return closed;
}

export function stripClosingPoint(points: Point[]): Point[] {
  if (points.length <= 1) {
    return points.map((point) => ({ ...point }));
  }

  const stripped = points.map((point) => ({ ...point }));
  const first = stripped[0];
  const last = stripped[stripped.length - 1];

  if (pointsEqual(first, last)) {
    stripped.pop();
  }

  return stripped;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Douglas-Peucker 简化算法
 */
export function douglasPeuckerIndices(
  points: Point[],
  tolerance: number
): number[] {
  if (points.length < 3) return points.map((_, i) => i);

  const indices: number[] = [];
  douglasPeucker(points, 0, points.length - 1, tolerance, indices);
  indices.sort((a, b) => a - b);
  return indices;
}

function douglasPeucker(
  points: Point[],
  start: number,
  end: number,
  tolerance: number,
  indices: number[]
): void {
  let maxDist = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[start], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    douglasPeucker(points, start, maxIdx, tolerance, indices);
    douglasPeucker(points, maxIdx, end, tolerance, indices);
  } else {
    indices.push(start);
    indices.push(end);
  }
}

export function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.lon - lineStart.lon;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.lon - lineStart.lon, 2) +
        Math.pow(point.lat - lineStart.lat, 2)
    );
  }

  const t =
    ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) /
    (dx * dx + dy * dy);

  if (t < 0) {
    return Math.sqrt(
      Math.pow(point.lon - lineStart.lon, 2) +
        Math.pow(point.lat - lineStart.lat, 2)
    );
  } else if (t > 1) {
    return Math.sqrt(
      Math.pow(point.lon - lineEnd.lon, 2) +
        Math.pow(point.lat - lineEnd.lat, 2)
    );
  }

  const nearest = {
    lon: lineStart.lon + t * dx,
    lat: lineStart.lat + t * dy,
  };

  return Math.sqrt(
    Math.pow(point.lon - nearest.lon, 2) + Math.pow(point.lat - nearest.lat, 2)
  );
}

function triangleArea(p1: Point, p2: Point, p3: Point): number {
  return (
    Math.abs(
      p1.lon * (p2.lat - p3.lat) +
        p2.lon * (p3.lat - p1.lat) +
        p3.lon * (p1.lat - p2.lat)
    ) / 2
  );
}

/**
 * Visvalingam-Whyatt 简化算法（返回保留点索引）
 */
export function visvalingamWhyattIndices(
  points: Point[],
  targetPoints: number
): number[] {
  const n = points.length;
  if (n < 3) return points.map((_, i) => i);

  const desiredCount = Math.max(2, Math.min(n, Math.round(targetPoints)));
  if (desiredCount >= n) return points.map((_, i) => i);

  const prev: number[] = Array.from({ length: n }, (_, i) => i - 1);
  const next: number[] = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? -1 : i + 1
  );
  const removed: boolean[] = new Array(n).fill(false);
  const versions: number[] = new Array(n).fill(0);

  type HeapEntry = { area: number; index: number; version: number };
  const heap: HeapEntry[] = [];

  const heapPush = (entry: HeapEntry): void => {
    heap.push(entry);
    let i = heap.length - 1;

    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent].area <= heap[i].area) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };

  const heapPop = (): HeapEntry | undefined => {
    if (heap.length === 0) return undefined;

    const top = heap[0];
    const last = heap.pop();

    if (heap.length > 0 && last) {
      heap[0] = last;
      let i = 0;

      while (true) {
        const left = i * 2 + 1;
        const right = i * 2 + 2;
        let smallest = i;

        if (left < heap.length && heap[left].area < heap[smallest].area) {
          smallest = left;
        }
        if (right < heap.length && heap[right].area < heap[smallest].area) {
          smallest = right;
        }
        if (smallest === i) break;

        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }

    return top;
  };

  const areaForIndex = (index: number): number => {
    const prevIndex = prev[index];
    const nextIndex = next[index];

    if (prevIndex < 0 || nextIndex < 0) {
      return Number.POSITIVE_INFINITY;
    }

    return triangleArea(points[prevIndex], points[index], points[nextIndex]);
  };

  for (let i = 1; i < n - 1; i++) {
    heapPush({ area: areaForIndex(i), index: i, version: versions[i] });
  }

  let remaining = n;

  while (remaining > desiredCount && heap.length > 0) {
    const entry = heapPop();
    if (!entry) break;

    const { index, version } = entry;

    if (
      removed[index] ||
      index === 0 ||
      index === n - 1 ||
      version !== versions[index]
    ) {
      continue;
    }

    const prevIndex = prev[index];
    const nextIndex = next[index];

    if (prevIndex < 0 || nextIndex < 0) {
      continue;
    }

    removed[index] = true;
    remaining--;

    next[prevIndex] = nextIndex;
    prev[nextIndex] = prevIndex;

    if (prevIndex > 0 && prevIndex < n - 1 && !removed[prevIndex]) {
      versions[prevIndex]++;
      heapPush({
        area: areaForIndex(prevIndex),
        index: prevIndex,
        version: versions[prevIndex],
      });
    }

    if (nextIndex > 0 && nextIndex < n - 1 && !removed[nextIndex]) {
      versions[nextIndex]++;
      heapPush({
        area: areaForIndex(nextIndex),
        index: nextIndex,
        version: versions[nextIndex],
      });
    }
  }

  const keepIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!removed[i]) keepIndices.push(i);
  }

  return keepIndices;
}

/**
 * 计算方位角
 */
export function calculateBearing(p1: Point, p2: Point): number {
  let lonDiff = p2.lon - p1.lon;
  if (lonDiff > 180) lonDiff -= 360;
  else if (lonDiff < -180) lonDiff += 360;
  const dLon = toRad(lonDiff);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * 方位转方向文字（英文缩写）
 */
export function bearingToDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  if (!Number.isFinite(bearing)) return directions[0];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

export function calculateLineLength(points: Point[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }

  return total;
}

export function calculateRingPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;

  const closed = closeRing(points);
  return calculateLineLength(closed);
}

export function sphericalPolygonArea(ring: Point[]): number {
  if (ring.length < 3) return 0;

  const closed = closeRing(ring);
  if (closed.length < 4) return 0;

  const earthRadius = 6378137;
  let total = 0;

  for (let i = 0; i < closed.length - 1; i++) {
    const p1 = closed[i];
    const p2 = closed[i + 1];
    const lonDelta = toRad(p2.lon - p1.lon);

    total += lonDelta * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }

  return Math.abs((total * earthRadius * earthRadius) / 2);
}

export function calculatePolygonArea(
  outerRing: Point[],
  holes: Point[][] = []
): number {
  const holeArea = holes.reduce(
    (sum, ring) => sum + sphericalPolygonArea(ring),
    0
  );
  return Math.max(0, sphericalPolygonArea(outerRing) - holeArea);
}

/**
 * 等距重采样 - 按固定距离间隔插入新点
 * 用于在简化前增加冗余点，保证关键转折不被丢失
 * @param points 原始轨迹点
 * @param intervalMeters 重采样间隔（米），默认 10m
 * @returns 重采样后的点
 */
export function equidistantResample(
  points: Point[],
  intervalMeters: number = 10
): Point[] {
  if (points.length < 2) return [...points];

  const result: Point[] = [{ ...points[0] }];
  let distSinceLastSample = 0;

  for (let i = 1; i < points.length; i++) {
    const segStart = points[i - 1];
    const segEnd = points[i];
    const segLen = haversineDistance(segStart, segEnd);

    if (segLen <= 0) continue;

    let consumed = 0;
    while (consumed < segLen) {
      const remaining = intervalMeters - distSinceLastSample;
      if (consumed + remaining > segLen) {
        distSinceLastSample += segLen - consumed;
        break;
      }
      consumed += remaining;
      distSinceLastSample = 0;

      const t = consumed / segLen;
      result.push({
        lat: segStart.lat + (segEnd.lat - segStart.lat) * t,
        lon: segStart.lon + (segEnd.lon - segStart.lon) * t,
      });
    }
  }

  const lastOriginal = points[points.length - 1];
  const lastResult = result[result.length - 1];
  if (
    lastResult.lat !== lastOriginal.lat ||
    lastResult.lon !== lastOriginal.lon
  ) {
    result.push({ ...lastOriginal });
  }

  return result;
}

export function equidistantResampleClosed(
  points: Point[],
  intervalMeters: number = 10
): Point[] {
  if (points.length < 3) {
    return closeRing(points);
  }

  return equidistantResample(closeRing(points), intervalMeters);
}
