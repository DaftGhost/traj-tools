import { Database } from 'bun:sqlite';
import { readdir } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  buildMbtilesSourceId,
  getMbtilesContentType,
  getMbtilesSourceType,
  getMbtilesTileRow,
  isGzipCompressed,
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

type CachedSource = MbtilesCatalogSource & {
  filePath: string;
};

const DEFAULT_PORT = 3001;
const DEFAULT_SCAN_TTL_MS = 5000;

const mbtilesDir = resolve(
  process.cwd(),
  process.env.MBTILES_DIR ?? 'data/mbtiles'
);
const port = Number.parseInt(process.env.MBTILES_PORT ?? `${DEFAULT_PORT}`, 10);

let cachedSources: CachedSource[] = [];
let lastScanAt = 0;

export function createSourceLabel(
  fileName: string,
  metadataName: string | null
): string {
  const trimmedName = metadataName?.trim();
  if (trimmedName) return trimmedName;
  return basename(fileName, extname(fileName));
}

function toByteArray(value: unknown): Uint8Array | null {
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

async function scanMbtilesSources(force = false): Promise<CachedSource[]> {
  const now = Date.now();
  if (!force && now - lastScanAt < DEFAULT_SCAN_TTL_MS) {
    return cachedSources;
  }

  lastScanAt = now;

  let entries;
  try {
    entries = await readdir(mbtilesDir, { withFileTypes: true });
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === 'ENOENT') {
      cachedSources = [];
      return cachedSources;
    }

    console.error('Failed to scan MBTiles directory:', error);
    cachedSources = [];
    return cachedSources;
  }

  const nextSources: CachedSource[] = [];
  const usedIds = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.mbtiles') {
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
        const label = createSourceLabel(entry.name, nameValue?.value ?? null);
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
        const label = createSourceLabel(entry.name, nameValue?.value ?? null);
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
      console.error(`Failed to index MBTiles file ${entry.name}:`, error);
    } finally {
      db?.close();
    }
  }

  cachedSources = nextSources;
  return cachedSources;
}

function createCatalogResponse(sources: CachedSource[]): Response {
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

async function handleCatalogRequest(): Promise<Response> {
  const sources = await scanMbtilesSources(true);
  return createCatalogResponse(sources);
}

async function handleTileRequest(
  sourceId: string,
  z: number,
  x: number,
  y: number
): Promise<Response> {
  const sources = await scanMbtilesSources();
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

function handleHealthRequest(): Response {
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

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/mbtiles/health') {
      return handleHealthRequest();
    }

    if (url.pathname === '/api/mbtiles/catalog') {
      return handleCatalogRequest();
    }

    const tileMatch = url.pathname.match(
      /^\/api\/mbtiles\/([^/]+)\/(\d+)\/(\d+)\/(\d+)$/
    );
    if (tileMatch) {
      const [, rawSourceId, z, x, y] = tileMatch;
      return handleTileRequest(
        decodeURIComponent(rawSourceId),
        Number.parseInt(z, 10),
        Number.parseInt(x, 10),
        Number.parseInt(y, 10)
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(
  `MBTiles server listening on http://127.0.0.1:${server.port} (directory: ${mbtilesDir})`
);
