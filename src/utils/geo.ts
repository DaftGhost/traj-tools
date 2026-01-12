/**
 * 地理计算工具函数
 */

export interface Point {
  lat: number;
  lon: number;
}

/**
 * 计算两点之间的 Haversine 距离（米）
 */
export function haversineDistance(p1: Point, p2: Point): number {
  const R = 6371000;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  const t = ((point.lon - lineStart.lon) * dx + (point.lat - lineStart.lat) * dy) /
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
    Math.pow(point.lon - nearest.lon, 2) +
      Math.pow(point.lat - nearest.lat, 2)
  );
}

/**
 * 计算方位角
 */
export function calculateBearing(p1: Point, p2: Point): number {
  const dLon = toRad(p2.lon - p1.lon);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * 方位转方向文字（英文缩写）
 */
export function bearingToDirection(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

