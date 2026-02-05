# Implementation Plan - 2026-02-05

## Source Analysis
- **Source Type**: Plan from conversation
- **Core Features**: Cloudflare Worker proxy for Tianditu + single-worker SPA hosting
- **Dependencies**: wrangler (Cloudflare Workers CLI)
- **Complexity**: Medium - requires Worker + Vite integration

## Target Integration
- **Integration Points**: src/map/layers.ts, src/map/index.ts, package.json
- **Affected Files**: 7 files (create 2, modify 5)
- **Pattern Matching**: Follow existing TypeScript patterns

## Implementation Tasks
1. [x] Create `wrangler.toml` - Cloudflare Worker config
2. [x] Create `src/worker.ts` - Worker entry with proxy endpoints
3. [x] Update `src/map/layers.ts` - Use proxy URLs + health check
4. [x] Update `src/map/index.ts` - Default to OSM if TDT not available
5. [x] Update `.env.example` - Document `TIANDITU_API_KEY`
6. [x] Update `src/vite-env.d.ts` - Remove client key typing
7. [x] Update `package.json` - Add wrangler and build scripts
8. [x] **Add Cache API logic in `src/worker.ts`** - cache-first, populate on success, stale-on-error
9. [x] **Improve cache headers** - SWR, stale-if-error, debug headers

## Cache Implementation Details
- **TTL**: `max-age=86400` (24h)
- **SWR**: `stale-while-revalidate=3600` (1h)
- **Stale-on-error**: enabled
- **Debug headers**: `X-Cache: HIT|MISS|STALE`
- **Cache key**: derive from `layer/z/x/y` (stable, no random subdomain)

## Validation Checklist
- [x] All features implemented
- [ ] SPA builds cleanly
- [ ] Worker runs locally
- [ ] Tianditu proxy works with key
- [ ] Fallback works without key
- [ ] Cache-first strategy works
- [ ] Stale-on-error fallback works
