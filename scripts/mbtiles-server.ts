import { resolve } from 'node:path';
import { createMbtilesServer, parseTilePath } from './requestHandlers';

const mbtilesDir = resolve(
  process.cwd(),
  process.env.MBTILES_DIR ?? 'data/mbtiles'
);
const port = Number.parseInt(
  process.env.MBTILES_PORT ?? '3001',
  10
);

const { health, catalog, tile } = createMbtilesServer({ mbtilesDir, port });

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/mbtiles/health') {
      return health();
    }

    if (url.pathname === '/api/mbtiles/catalog') {
      return catalog();
    }

    const tileParams = parseTilePath(url.pathname);
    if (tileParams) {
      return tile(tileParams.sourceId, tileParams.z, tileParams.x, tileParams.y);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(
  `MBTiles server listening on http://127.0.0.1:${server.port} (directory: ${mbtilesDir})`
);
