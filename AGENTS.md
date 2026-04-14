# AGENTS.md

Practical working guide for coding agents in `traj-tools`.
This file reflects the repository state verified on 2026-04-14.

## Rule Sources

- This repository has a root `AGENTS.md`: this file.
- No `.cursorrules` file exists.
- No `.cursor/rules/` directory exists.
- No `.github/copilot-instructions.md` file exists.
- If Cursor or Copilot rule files are added later, treat them as additional repository-local instructions and merge them with this guide.

## Repository Snapshot

- Stack: Vite 5, TypeScript 5, Vue 3, Vitest 1, Leaflet 1.9, Leaflet.VectorGrid, Cloudflare Workers, Bun runtime scripts.
- Package manager: `bun`.
- Frontend entrypoint: `src/main.ts`; worker entrypoint: `src/worker.ts`; local MBTiles service entrypoint: `scripts/mbtiles-server.ts`.
- Main application shell and layout live in `src/App.vue` and `src/components/`.
- Central mutable state singleton: `src/state/store.ts`.
- Route geometry and CRUD logic live mainly in `src/routes/geometry.ts` and `src/routes/index.ts`.
- Import/export logic live in `src/import/index.ts` and `src/export/index.ts`.
- Basemap registration lives in `src/map/layers.ts`; built-in vector MBTiles styling lives in `src/map/vectorStyle.ts`.
- UI is split between Vue single-file components under `src/components/` and imperative initialization/event wiring in `src/ui/index.ts`.
- Local MBTiles support is Leaflet-only. Raster MBTiles render as tile layers, vector MBTiles render through the built-in VectorGrid style path. Custom vector styles, labels, sprites, POI overlays, and MapLibre integration are not supported.
- Generated output lives in `dist/` and `dist-worker/`; do not treat them as hand-edited source.

## Install And Dev Commands

- Install dependencies: `bun install`
- Frontend dev server: `bun run dev` on port `3000`
- Local MBTiles dev server: `MBTILES_DIR=./data/mbtiles bun run dev:mbtiles`
- Worker dev server: `bun run dev:worker`
- Preview production build: `bun run preview`; deploy frontend + worker: `bun run deploy`
- When running the Worker against local MBTiles, set `MBTILES_PROXY_URL=http://127.0.0.1:3001` before `bun run dev:worker`.

## Build, Lint, And Format Commands

- Production build + type check: `bun run build`
- Alias of build: `bun run build:all`
- Frontend type check only: `bun run typecheck`
- Script type check example: `bunx tsc -p tsconfig.scripts.json --noEmit`
- Lint: `bun run lint` (`eslint src --ext ts,vue`, so it targets TypeScript and Vue files under `src/`)
- Format: `bun run format` (`prettier --write src`, so it only formats files under `src/`)

## Test Commands

- Run all tests once: `bun run test`; watch mode: `bun run test:watch`; Vitest UI: `bun run test:ui`
- Run one test file: `bun run test -- src/routes/geometry.test.ts`
- Run one named test: `bun run test -- src/utils/helpers.test.ts -t "should swap English \"left\" to \"right\""`
- Another useful single-file example: `bun run test -- src/ui/index.test.ts`

## Verified Command Status

- `bunx tsc -p tsconfig.scripts.json --noEmit` passes for the Bun script entrypoints.
- `bun run test` passes; current verified Vitest result is 247 passing tests.
- `bun run build` passes and performs frontend TypeScript validation because it runs `vue-tsc --noEmit -p tsconfig.json && vite build`.
- `bun run build` may still emit Vite chunking warnings, but the build succeeds.
- `bun run lint` is available for `src/**/*.ts` and `src/**/*.vue`. Do not claim it passes unless you actually run it in the current task.

## Validation Expectations For Agents

- For any TypeScript or Vue change, run `bun run build` before finishing.
- Run `bun run lint` when you touch linted TypeScript files, Vue files, or ESLint config.
- Run `bunx tsc -p tsconfig.scripts.json --noEmit` when you modify files under `scripts/` or shared code used by those Bun entrypoints.
- For behavior changes, run the narrowest relevant test file first.
- For route geometry, import/export, basemap, MBTiles, or shared UI/store changes, run `bun run test` before finishing.
- If you modify lint config, re-run `bun run lint` and report the real result.
- Do not claim lint passes unless you actually ran it successfully.

## Imports And Module Boundaries

- Use ES modules throughout.
- Keep external imports before internal imports.
- Prefer `import type` for type-only imports.
- Relative imports are the dominant style inside `src/`; `@/*` alias exists but is not the common local convention.
- In entrypoint-style files, keep side-effect imports grouped after normal imports, and preserve existing lazy `import(...)` call sites unless there is a clear reason to refactor them.
- Keep modules focused by domain: `routes`, `ui`, `map`, `tools`, `utils`, `import`, `export`, `state`.
- Prefer a small helper in the current file before creating a brand new module.

## Formatting Conventions

- Indentation: 2 spaces.
- Quotes: single quotes; semicolons required; trailing commas use `es5` style.
- Preferred print width: 80.
- Line endings: Unix.
- Match surrounding formatting when editing existing files.
- Avoid unrelated style churn in files you touch.

## TypeScript And Vue Conventions

- `strict` mode is enabled; `noFallthroughCasesInSwitch` is enabled; preserve both behaviors.
- `noUnusedLocals` and `noUnusedParameters` are disabled, but do not rely on that to leave dead code behind.
- Prefer explicit interfaces and union types over `any`.
- Prefer `unknown` at boundaries, then narrow.
- Use narrow DOM casts such as `as HTMLInputElement | null` when needed; use `as unknown as ...` only when an external API or test setup genuinely requires it.
- Vue components should use `<script setup lang="ts">` and PascalCase component imports.

## Naming Conventions

- Variables and functions: `camelCase`; types, interfaces, classes, and Vue components: `PascalCase`; constant-style config values: `UPPER_SNAKE_CASE`.
- Test descriptions use natural-language `describe` and `it` strings.
- Preserve existing Chinese user-facing strings and comments unless the surrounding file is clearly English-only.

## Control Flow And Code Shape

- Prefer guard clauses and early returns.
- Avoid deep nesting when a quick validity check can exit early.
- Keep most logic in plain functions.
- Avoid introducing classes unless extending the existing `StateStore` pattern or another clearly class-based area; prefer direct, readable code over clever abstractions.
- Comments should be sparse and mainly explain non-obvious geometry, cache, or coordinate logic.

## Error Handling Patterns

- In browser-facing code, recoverable failures are often surfaced with `alert(...)`, `setStatus(...)`, or `console.error(...)`.
- In route helpers, invalid operations commonly return `null` or `false` instead of throwing.
- In `src/import/index.ts`, invalid file content often results in `Error` throws after validation, but malformed GeoJSON JSON currently logs and returns an empty list.
- In the Worker, return explicit `Response` objects with status codes instead of throwing through the fetch handler.

## Data And Domain Invariants

- App point objects use `{ lat, lon }`.
- Leaflet APIs may use `lng`; convert carefully at boundaries.
- GeoJSON coordinates must remain `[lon, lat]`.
- `Route.geometryType` is `'polyline'` or `'polygon'`.
- For polygons, `route.points` is the outer ring, `route.holes` stores inner rings, `ringIndex === 0` means the outer ring, and `ringIndex > 0` maps to `route.holes[ringIndex - 1]`.
- `_display`, `_distCache`, `_holeDistCaches`, and `heatLayer` are runtime/cache fields, not clean persisted model fields.
- If route geometry changes, update or invalidate related caches and refresh display geometry when needed.
- Keep polygon minimum-vertex rules intact when deleting or simplifying rings.

## State And UI Conventions

- `store` is a mutable singleton shared across modules.
- Many modules import `store` directly; preserve that pattern unless the task explicitly asks for refactoring.
- UI initialization is side-effect driven from `src/main.ts`; DOM-heavy code usually uses `getElementById`, null checks, and direct event listeners.
- When a task changes selection or visible route data, refresh the affected UI panels or lists if the current module owns that responsibility.

## Testing Conventions

- Tests are colocated with source as `*.test.ts` under `src/`.
- Most current tests run under jsdom and declare `@vitest-environment jsdom` at the top of the file.
- Use `vi.mock(...)` or `vi.doMock(...)` to isolate Leaflet and other dependencies; when mocks must apply before module evaluation, import the module under test after the mock is set up.
- Reset shared singleton state in `beforeEach` when tests mutate `store`.
- Prefer focused unit tests around geometry, import/export, store behavior, and UI command behavior.

## Environment And Secrets

- Worker runtime expects `TIANDITU_API_KEY`.
- Local Worker development uses `.dev.vars`.
- Local MBTiles development can use `MBTILES_DIR`, `MBTILES_PORT`, and `MBTILES_PROXY_URL`.
- Do not hardcode API keys or commit local env files with real credentials.

## Files Agents Should Usually Avoid Editing

- `dist/`, `dist-worker/`, `node_modules/`, and generated assets unless the task is specifically about build output.

## Practical Default Workflow

- Read the relevant module and its colocated tests first.
- Make the smallest correct change.
- Run the narrowest relevant test file.
- Run `bun run build` for final TypeScript validation.
- Run `bun run test` for broader behavior changes.
- Report command results honestly, especially the current lint caveat.
