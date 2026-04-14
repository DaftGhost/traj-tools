export type MbtilesVectorLayer = {
  id: string;
  description: string;
  minZoom: number;
  maxZoom: number;
};

export type MbtilesCatalogSource = {
  id: string;
  label: string;
  format: string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number] | null;
  attribution: string;
  sourceType?: 'raster' | 'vector';
  vectorLayers?: MbtilesVectorLayer[];
};

export type MbtilesCatalogResponse = {
  sources: MbtilesCatalogSource[];
};

const RASTER_MBTILES_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const VECTOR_MBTILES_FORMATS = new Set(['pbf']);

function normalizeFormat(format: string): string {
  return format.trim().toLowerCase();
}

export type MbtilesSourceType = 'raster' | 'vector';

export function getMbtilesSourceType(format: string): MbtilesSourceType | null {
  const normalized = normalizeFormat(format);
  if (RASTER_MBTILES_FORMATS.has(normalized)) return 'raster';
  if (VECTOR_MBTILES_FORMATS.has(normalized)) return 'vector';
  return null;
}

function hashMbtilesFileName(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function isSupportedMbtilesFormat(format: string): boolean {
  const normalized = normalizeFormat(format);
  return (
    RASTER_MBTILES_FORMATS.has(normalized) ||
    VECTOR_MBTILES_FORMATS.has(normalized)
  );
}

export function getMbtilesTileRow(zoom: number, xyzY: number): number {
  return 2 ** zoom - 1 - xyzY;
}

export function buildMbtilesSourceId(
  fileName: string,
  usedIds: Set<string> = new Set()
): string {
  const baseName = fileName.replace(/\.mbtiles$/i, '');
  const normalized =
    baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mbtiles';

  const hash = hashMbtilesFileName(fileName).slice(0, 6);
  let candidate = normalized === 'mbtiles' ? `mbtiles-${hash}` : normalized;

  if (usedIds.has(candidate)) {
    candidate = `${normalized}-${hash}`;
  }

  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${normalized}-${hash}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

export function getMbtilesContentType(format: string): string {
  switch (format.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'pbf':
      return 'application/vnd.mapbox-vector-tile';
    case 'png':
    default:
      return 'image/png';
  }
}

export function parseMbtilesBounds(
  value: string | null
): [number, number, number, number] | null {
  if (!value) return null;

  const parsed = value
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));

  if (parsed.length !== 4) {
    return null;
  }

  return parsed as [number, number, number, number];
}

export function isGzipCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}
