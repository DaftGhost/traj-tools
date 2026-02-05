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
1. [ ] Create `wrangler.toml` - Cloudflare Worker config
2. [ ] Create `src/worker.ts` - Worker entry with proxy endpoints
3. [ ] Update `src/map/layers.ts` - Use proxy URLs + health check
4. [ ] Update `src/map/index.ts` - Default to OSM if TDT not available
5. [ ] Update `.env.example` - Document `TIANDITU_API_KEY`
6. [ ] Update `src/vite-env.d.ts` - Remove client key typing
7. [ ] Update `package.json` - Add wrangler and build scripts

## Validation Checklist
- [ ] All features implemented
- [ ] SPA builds cleanly
- [ ] Worker runs locally
- [ ] Tianditu proxy works with key
- [ ] Fallback works without key

## Risk Mitigation
- **Potential Issues**: Worker Assets binding requires proper config
- **Rollback Strategy**: Git commits at each step
