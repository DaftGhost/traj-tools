# AGENTS.md

Practical working guide for coding agents in `traj-tools`.
This file reflects the repository state verified on 2026-04-03.

## Rule Sources

- This repository has a root `AGENTS.md`: this file.
- No `.cursorrules` file exists.
- No `.cursor/rules/` directory exists.
- No `.github/copilot-instructions.md` file exists.
- If Cursor or Copilot rule files are added later, treat them as additional repository-local instructions and merge them with this guide.

## Repository Snapshot

- Stack: Vite 5, TypeScript 5, Vue 3, Vitest 1, Leaflet 1.9, Cloudflare Workers.
- Package manager: `npm`.
- Frontend entrypoint: `src/main.ts`; worker entrypoint: `src/worker.ts`.
- Main application shell and layout live in `src/App.vue` and `src/components/`.
- Central mutable state singleton: `src/state/store.ts`.
- Route geometry and CRUD logic live mainly in `src/routes/geometry.ts` and `src/routes/index.ts`.
- Import/export logic live in `src/import/index.ts` and `src/export/index.ts`.
- Most UI behavior is imperative DOM wiring in `src/ui/index.ts`, not reactive Vue state.
- Generated output lives in `dist/` and `dist-worker/`; do not treat them as hand-edited source.

## Install And Dev Commands

- Install dependencies: `npm install`
- Frontend dev server: `npm run dev` on port `3000`
- Worker dev server: `npm run dev:worker`
- Preview production build: `npm run preview`; deploy frontend + worker: `npm run deploy`

## Build, Lint, And Format Commands

- Production build + type check: `npm run build`
- Alias of build: `npm run build:all`
- Lint: `npm run lint` (`eslint src --ext ts`, so it only targets TypeScript under `src/`)
- Format: `npm run format` (`prettier --write src`, so it only formats files under `src/`)

## Test Commands

- Run all tests once: `npm run test`; watch mode: `npm run test:watch`; Vitest UI: `npm run test:ui`
- Run one test file: `npm run test -- src/routes/geometry.test.ts`
- Run one named test: `npm run test -- src/utils/helpers.test.ts -t "should swap English \"left\" to \"right\""`
- Another useful single-file example: `npm run test -- src/ui/index.test.ts`

## Verified Command Status

- `npm run test` passes; current verified Vitest result is 11 test files and 128 tests. `npm run test -- src/routes/geometry.test.ts` also passes.
- `npm run build` passes and performs TypeScript validation because it runs `tsc && vite build`.
- `npm run build` emits Vite warnings about modules that are both statically and dynamically imported, but the build still succeeds. There is no standalone `typecheck` script.
- `npm run lint` now passes after enabling `@typescript-eslint/parser` and cleaning up the resulting real rule violations.

## Validation Expectations For Agents

- For any TypeScript change, run `npm run build` before finishing.
- Run `npm run lint` when you touch linted TypeScript files or ESLint config.
- For behavior changes, run the narrowest relevant test file first.
- For route geometry, import/export, or shared UI/store changes, run `npm run test` before finishing.
- If you modify lint config, re-run `npm run lint` and report the real result.
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
- Do not hardcode API keys or commit local env files with real credentials.

## Files Agents Should Usually Avoid Editing

- `dist/`, `dist-worker/`, `node_modules/`, and generated assets unless the task is specifically about build output.

## Practical Default Workflow

- Read the relevant module and its colocated tests first.
- Make the smallest correct change.
- Run the narrowest relevant test file.
- Run `npm run build` for final TypeScript validation.
- Run `npm run test` for broader behavior changes.
- Report command results honestly, especially the current lint caveat.
