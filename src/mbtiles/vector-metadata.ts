/**
 * Normalized vector layer with guaranteed field shapes.
 * Contrast with MbtilesVectorLayer which has all required fields -
 * this type represents the output of normalization with defaults applied.
 */
export type NormalizedVectorLayer = {
  id: string;
  description: string;
  minZoom: number;
  maxZoom: number;
};

/**
 * Result of vector metadata extraction from MBTiles metadata table.
 * - usable=true: vector_layers were found and normalized successfully
 * - usable=false: source cannot be used as a vector source, with a deterministic reason
 */
export type VectorMetadataResult =
  | { usable: true; vectorLayers: NormalizedVectorLayer[] }
  | { usable: false; reason: UnusableReason };

/**
 * Deterministic reasons why a pbf source cannot be used as a vector source.
 */
export type UnusableReason =
  | 'not_vector_format'
  | 'missing_metadata_json'
  | 'malformed_metadata_json'
  | 'missing_vector_layers'
  | 'empty_vector_layers'
  | 'malformed_vector_layers';

const UNUSABLE_REASONS: Record<UnusableReason, string> = {
  not_vector_format: 'format is not pbf',
  missing_metadata_json: 'metadata json entry is missing or empty',
  malformed_metadata_json: 'metadata json is not valid JSON',
  missing_vector_layers: 'vector_layers field is missing from metadata',
  empty_vector_layers: 'vector_layers array is empty',
  malformed_vector_layers:
    'vector_layers is not a valid array of layer objects',
};

/**
 * Returns a deterministic reason string for an unusable vector source.
 */
export function getUnusableReasonText(reason: UnusableReason): string {
  return UNUSABLE_REASONS[reason];
}

/**
 * Checks if a raw value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if a value is a finite number usable as a zoom level.
 */
function isValidZoom(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Normalizes a raw vector layer object into a DeterministicVectorLayer.
 * Returns null if the layer cannot be normalized.
 */
function normalizeLayer(raw: unknown): NormalizedVectorLayer | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.id)) {
    return null;
  }

  const rawMinZoom = obj.minzoom;
  const rawMaxZoom = obj.maxzoom;

  const hasMinZoom = isValidZoom(rawMinZoom);
  const hasMaxZoom = isValidZoom(rawMaxZoom);

  if (rawMinZoom !== undefined && !hasMinZoom) return null;
  if (rawMaxZoom !== undefined && !hasMaxZoom) return null;

  const minZoom = hasMinZoom ? Math.floor(rawMinZoom as number) : 0;
  const maxZoom = hasMaxZoom ? Math.floor(rawMaxZoom as number) : 22;

  if (minZoom > maxZoom) {
    return {
      id: String(obj.id).trim(),
      description: isNonEmptyString(obj.description)
        ? obj.description.trim()
        : '',
      minZoom: 0,
      maxZoom: Math.min(22, minZoom),
    };
  }

  return {
    id: String(obj.id).trim(),
    description: isNonEmptyString(obj.description)
      ? obj.description.trim()
      : '',
    minZoom: Math.max(0, minZoom),
    maxZoom: Math.min(22, maxZoom),
  };
}

/**
 * Parses the `json` field from MBTiles metadata and extracts vector_layers.
 *
 * @param metadataJson - The raw string value of the `json` metadata entry, or null if not present
 * @param format - The format string from metadata (e.g., 'pbf', 'png')
 * @returns VectorMetadataResult indicating whether the source is usable as vector
 *
 * @example
 * // Valid pbf with vector_layers
 * parseVectorMetadata('{"vector_layers":[{"id":"layer1","description":"...","minzoom":0,"maxzoom":14}]}', 'pbf')
 * // → { usable: true, vectorLayers: [{ id: 'layer1', description: '...', minZoom: 0, maxZoom: 14 }] }
 *
 * @example
 * // pbf but missing vector_layers
 * parseVectorMetadata('{"name":"test"}', 'pbf')
 * // → { usable: false, reason: 'missing_vector_layers' }
 */
export function parseVectorMetadata(
  metadataJson: string | null,
  format: string
): VectorMetadataResult {
  // Fast path: not a vector format
  const normalizedFormat = format.trim().toLowerCase();
  if (normalizedFormat !== 'pbf') {
    return { usable: false, reason: 'not_vector_format' };
  }

  // Missing or empty metadata json
  if (!isNonEmptyString(metadataJson)) {
    return { usable: false, reason: 'missing_metadata_json' };
  }

  // Parse the json string
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(metadataJson);
  } catch {
    return { usable: false, reason: 'malformed_metadata_json' };
  }

  // Check for vector_layers field
  if (!Object.prototype.hasOwnProperty.call(parsed, 'vector_layers')) {
    return { usable: false, reason: 'missing_vector_layers' };
  }

  const rawLayers = parsed.vector_layers;

  // Must be an array
  if (!Array.isArray(rawLayers)) {
    return { usable: false, reason: 'malformed_vector_layers' };
  }

  // Empty array is unusable
  if (rawLayers.length === 0) {
    return { usable: false, reason: 'empty_vector_layers' };
  }

  // Normalize each layer; if any fail, the whole set is malformed
  const normalizedLayers: NormalizedVectorLayer[] = [];
  for (const raw of rawLayers) {
    const normalized = normalizeLayer(raw);
    if (normalized === null) {
      return { usable: false, reason: 'malformed_vector_layers' };
    }
    normalizedLayers.push(normalized);
  }

  return { usable: true, vectorLayers: normalizedLayers };
}

/**
 * Extracts the json metadata value from an MBTiles metadata query result row.
 * Returns the string value if present and non-null, or null otherwise.
 *
 * @param row - A metadata row from `SELECT value FROM metadata WHERE name = 'json'`
 * @returns The json string, or null if not found/null
 */
export function extractMetadataJson(row: unknown): string | null {
  if (row === null || row === undefined) {
    return null;
  }

  if (typeof row === 'object' && !ArrayBuffer.isView(row) && row !== null) {
    const obj = row as Record<string, unknown>;
    const value = obj.value;
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

/**
 * Combines format check and vector metadata extraction into a single call.
 * Useful when scanning MBTiles metadata row-by-row.
 *
 * @param metadataJsonRow - The raw row from `SELECT value FROM metadata WHERE name = 'json'`
 * @param format - The normalized format string (already lowercased)
 * @returns VectorMetadataResult
 */
export function extractVectorMetadata(
  metadataJsonRow: unknown,
  format: string
): VectorMetadataResult {
  const json = extractMetadataJson(metadataJsonRow);
  return parseVectorMetadata(json, format);
}
