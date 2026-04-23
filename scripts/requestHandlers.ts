import { Database } from 'bun:sqlite';
import { readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  buildMbtilesSourceId,
  getMbtilesContentType,
  getMbtilesSourceType,
  getMbtilesTileRow,
  isSupportedMbtilesFormat,
  parseMbtilesBounds,
  type MbtilesCatalogResponse,
  type MbtilesCatalogSource,
} from '../src/mbtiles/shared';
import { maybeDecompress } from './mbtiles-decompress';
import {
  extractMetadataJson,
  extractVectorMetadata,
} from '../src/mbtiles/vector-metadata';

export type CachedSource = MbtilesCatalogSource & {
  filePath: string;
};

export const DEFAULT_PORT = 3001;
export const DEFAULT_SCAN_TTL_MS = 5000;

export function createSourceLabel(
  fileName: string,
  metadataName: string | null
): string {
  const trimmedName = metadataName?.trim();
  if (trimmedName) return trimmedName;
  return basename(fileName, extname(fileName));
}

export function parseTilePath(
  pathname: string
): { sourceId: string; z: number; x: number; y: number } | null {
  const match = pathname.match(
    /^\/api\/mbtiles\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/
  );
  if (!match) return null;
  const [, rawSourceId, z, x, y] = match;
  return {
    sourceId: decodeURIComponent(rawSourceId),
    z: Number.parseInt(z, 10),
    x: Number.parseInt(x, 10),
    y: Number.parseInt(y, 10),
  };
}

export function toByteArray(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function hasReadableTilesRelation(db: Database): boolean {
  const singleQuote = String.fromCharCode(39);
  const quotedTable = singleQuote + 'table' + singleQuote;
  const quotedView = singleQuote + 'view' + singleQuote;
  const quotedTiles = singleQuote + 'tiles' + singleQuote;
  const relationQuery = [
    'SELECT name FROM sqlite_master',
    'WHERE (type = ' + quotedTable + ' OR type = ' + quotedView + ')',
    'AND name = ' + quotedTiles + ' LIMIT 1',
  ].join(' ');

  const relation = db.query(relationQuery).get() as { name?: string } | null;

  return relation?.name === 'tiles';
}

async function scanSources(
  mbtilesDir: string,
  cachedSources: CachedSource[],
  lastScanAt: number,
  force = false
): Promise<{ sources: CachedSource[]; lastScanAt: number }> {
  const now = Date.now();
  if (!force && now - lastScanAt < DEFAULT_SCAN_TTL_MS) {
    return { sources: cachedSources, lastScanAt };
  }

  lastScanAt = now;

  let entries;
  try {
    entries = await readdir(mbtilesDir, { withFileTypes: true });
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ENOENT') {
      return { sources: [], lastScanAt };
    }

    console.error('Failed to scan MBTiles directory:', error);
    return { sources: [], lastScanAt };
  }

  const nextSources: CachedSource[] = [];
  const usedIds = new Set<string>();

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      extname(entry.name).toLowerCase() !== '.mbtiles'
    ) {
      continue;
    }

    const filePath = resolve(mbtilesDir, entry.name);
    let db: Database | null = null;

    try {
      db = new Database(filePath, { readonly: true });

      if (!hasReadableTilesRelation(db)) {
        continue;
      }

      const getMetadataValue = db.query(
        'SELECT value FROM metadata WHERE name = ? LIMIT 1'
      );

      const formatValue = getMetadataValue.get('format') as {
        value?: string;
      } | null;
      const format = formatValue?.value?.trim().toLowerCase() ?? 'png';
      if (!isSupportedMbtilesFormat(format)) {
        continue;
      }

      const sourceType = getMbtilesSourceType(format);
      if (sourceType === 'vector') {
        const jsonRow = getMetadataValue.get('json');
        const vectorResult = extractVectorMetadata(jsonRow, format);
        if (!vectorResult.usable) {
          continue;
        }

        const nameValue = getMetadataValue.get('name') as {
          value?: string;
        } | null;
        const minZoomValue = getMetadataValue.get('minzoom') as {
          value?: string;
        } | null;
        const maxZoomValue = getMetadataValue.get('maxzoom') as {
          value?: string;
        } | null;
        const boundsValue = getMetadataValue.get('bounds') as {
          value?: string;
        } | null;
        const attributionValue = getMetadataValue.get('attribution') as {
          value?: string;
        } | null;

        const id = buildMbtilesSourceId(entry.name, usedIds);
        const label = createSourceLabel(
          entry.name,
          nameValue?.value ?? null
        );
        const bounds = parseMbtilesBounds(boundsValue?.value ?? null);

        nextSources.push({
          id,
          label,
          format,
          minZoom: Number.parseInt(minZoomValue?.value ?? '0', 10) || 0,
          maxZoom: Number.parseInt(maxZoomValue?.value ?? '18', 10) || 18,
          bounds,
          attribution: attributionValue?.value?.trim() || 'Local MBTiles',
          sourceType: 'vector',
          vectorLayers: vectorResult.vectorLayers,
          filePath,
        });
      } else {
        const nameValue = getMetadataValue.get('name') as {
          value?: string;
        } | null;
        const minZoomValue = getMetadataValue.get('minzoom') as {
          value?: string;
        } | null;
        const maxZoomValue = getMetadataValue.get('maxzoom') as {
          value?: string;
        } | null;
        const boundsValue = getMetadataValue.get('bounds') as {
          value?: string;
        } | null;
        const attributionValue = getMetadataValue.get('attribution') as {
          value?: string;
        } | null;

        const id = buildMbtilesSourceId(entry.name, usedIds);
        const label = createSourceLabel(
          entry.name,
          nameValue?.value ?? null
        );
        const bounds = parseMbtilesBounds(boundsValue?.value ?? null);

        nextSources.push({
          id,
          label,
          format,
          minZoom: Number.parseInt(minZoomValue?.value ?? '0', 10) || 0,
          maxZoom: Number.parseInt(maxZoomValue?.value ?? '18', 10) || 18,
          bounds,
          attribution: attributionValue?.value?.trim() || 'Local MBTiles',
          sourceType: 'raster',
          filePath,
        });
      }
    } catch (error) {
      console.error(
        `Failed to index MBTiles file ${entry.name}:`,
        error
      );
    } finally {
      db?.close();
    }
  }

  return { sources: nextSources, lastScanAt };
}

export function buildCatalogResponse(sources: MbtilesCatalogSource[]): Response {
  const body: MbtilesCatalogResponse = {
    sources: sources.map((source) => {
      const entry: MbtilesCatalogSource = {
        id: source.id,
        label: source.label,
        format: source.format,
        minZoom: source.minZoom,
        maxZoom: source.maxZoom,
        bounds: source.bounds,
        attribution: source.attribution,
        sourceType: source.sourceType,
      };
      if (source.sourceType === 'vector' && source.vectorLayers) {
        entry.vectorLayers = source.vectorLayers;
      }
      return entry;
    }),
  };

  return Response.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export interface ServerState {
  cachedSources: CachedSource[];
  lastScanAt: number;
}

export interface MbtilesServerHandlers {
  mbtilesDir: string;
  port: number;
  state: ServerState;
  health: () => Response;
  catalog: () => Promise<Response>;
  tile: (sourceId: string, z: number, x: number, y: number) => Promise<Response>;
}

export function createMbtilesServer({
  mbtilesDir,
  port,
}: {
  mbtilesDir: string;
  port: number;
}): MbtilesServerHandlers {
  const state: ServerState = {
    cachedSources: [],
    lastScanAt: 0,
  };

  function health(): Response {
    return Response.json(
      {
        available: true,
        directory: mbtilesDir,
        port,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  async function catalog(): Promise<Response> {
    const { sources } = await scanSources(
      mbtilesDir,
      state.cachedSources,
      state.lastScanAt,
      true
    );
    state.cachedSources = sources;
    state.lastScanAt = Date.now();
    return buildCatalogResponse(sources);
  }

  async function tile(
    sourceId: string,
    z: number,
    x: number,
    y: number
  ): Promise<Response> {
    const { sources } = await scanSources(
      mbtilesDir,
      state.cachedSources,
      state.lastScanAt,
      false
    );
    state.cachedSources = sources;
    state.lastScanAt = Date.now();

    const source = sources.find((item) => item.id === sourceId);
    if (!source) {
      return new Response('MBTiles source not found', { status: 404 });
    }

    let db: Database | null = null;
    try {
      db = new Database(source.filePath, { readonly: true });
      const tileRow = getMbtilesTileRow(z, y);
      const tile = db
        .query(
          'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1'
        )
        .get(z, x, tileRow) as { tile_data?: unknown } | null;

      const rawData = toByteArray(tile?.tile_data);
      if (!rawData) {
        return new Response('Tile not found', { status: 404 });
      }

      const tileData = await maybeDecompress(rawData);

      return new Response(new Uint8Array(tileData), {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'Content-Type': getMbtilesContentType(source.format),
        },
      });
    } catch (error) {
      console.error(
        `Failed to read MBTiles tile ${sourceId}/${z}/${x}/${y}:`,
        error
      );
      return new Response('Failed to read tile', { status: 500 });
    } finally {
      db?.close();
    }
  }

  return { mbtilesDir, port, state, health, catalog, tile };
}
