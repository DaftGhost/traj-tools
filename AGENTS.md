# AGENTS.md

This is the working guide for coding agents operating in `traj-tools`.
It reflects the repository state observed on 2026-04-02 and is meant to be practical rather than exhaustive.

## Agent Rule Sources

- No preexisting root `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` file was found.
- Treat this file as the only repository-local agent instruction source unless those files are added later.

## Repository Snapshot

- Stack: Vite 5, TypeScript 5, Vue 3, Vitest 1, Leaflet 1.9, Cloudflare Workers.
- Package manager: `npm`; source of truth lives under `src/`.
- Frontend entrypoint: `src/main.ts`; Worker entrypoint: `src/worker.ts`.
- Central app state lives in `src/state/store.ts`.
- Route geometry logic lives mainly in `src/routes/geometry.ts`.
- Import/export logic lives in `src/import/index.ts` and `src/export/index.ts`.
- Most UI behavior is imperative DOM wiring in `src/ui/index.ts`, not reactive Vue state.
- Vue is mainly used for the shell/layout in `src/App.vue` and `src/components/**/*.vue`.
- Built artifacts live in `dist/` and `dist-worker/`; do not treat them as hand-edited source.

## Setup And Core Commands

- Install dependencies: `npm install`
- Frontend dev server: `npm run dev`
- Actual Vite dev port is `3000` per `vite.config.ts`.
- Worker dev server: `npm run dev:worker`
- Production build: `npm run build`
- Preview production build: `npm run preview`
- Deploy Worker + frontend: `npm run deploy`

## Test Commands

- Run all tests once: `npm run test`
- Run tests in watch mode: `npm run test:watch`
- Open Vitest UI: `npm run test:ui`
- Run one test file: `npm run test -- src/routes/geometry.test.ts`
- Run one named test: `npm run test -- src/utils/helpers.test.ts -t "should swap English \"left\" to \"right\""`

## Lint And Format Commands

- Lint command in `package.json`: `npm run lint`
- Format command in `package.json`: `npm run format`
- `npm run format` only targets `src/`; Prettier config is in `.prettierrc`; ESLint ignore file is `.eslintignore`.

## Verified Command Status

- `npm run test` passes: 10 test files, 126 tests.
- `npm run build` passes and also performs type checking because it runs `tsc && vite build`.
- There is no standalone `typecheck` script today; use `npm run build` for type validation.
- `npm run lint` is currently not reliable.
- Current lint failure reason: `.eslintrc.json` does not enable `@typescript-eslint/parser`, so ESLint fails on TypeScript syntax before applying useful rules.
- Until lint config is repaired, treat `npm run build` and targeted `npm run test -- <file>` runs as the primary validation path.

## Validation Expectations For Agents

- For TypeScript logic changes, run `npm run build`.
- For behavior changes, run the smallest relevant Vitest file first.
- For broader route or import/export changes, run `npm run test` before finishing.
- If you change lint config, re-run `npm run lint` and report whether it is fixed; otherwise do not claim lint passes.

## Import And Module Conventions

- Use ES modules throughout.
- Keep external imports before internal imports.
- Keep side-effect imports grouped after normal imports in entrypoint-style files.
- Prefer `import type` for type-only imports.
- Path alias `@/*` is configured, but the existing codebase mostly uses relative imports inside `src/`; match nearby files.
- Keep modules focused by domain: `routes`, `tools`, `ui`, `utils`, `map`, `import`, `export`, `state`.
- Prefer adding a small helper inside the current file before creating a new module.

## Formatting Conventions

- Indentation: 2 spaces.
- Quotes: single quotes; semicolons required; trailing commas use `es5` style.
- Preferred print width: 80.
- Line endings: Unix.
- Match the surrounding file before making style-only cleanups.

## TypeScript Conventions

- `strict` mode is enabled; preserve type safety.
- `noFallthroughCasesInSwitch` is enabled; handle switch cases explicitly.
- Prefer explicit interfaces and union types over `any`.
- Use narrow DOM casts like `as HTMLInputElement | null` and prefer `unknown` at boundaries, then narrow.
- Return `undefined` from lookup-style methods when that is the existing pattern.
- Return `null` or `false` for expected operational failures when that is the existing pattern.
- Throw `Error` mainly in parser/validation code where callers already handle failure.

## Naming Conventions

- Variables and functions: `camelCase`.
- Types, interfaces, classes, and Vue components: `PascalCase`.
- Constants and config objects that act like constants: `UPPER_SNAKE_CASE`.
- Test descriptions use natural-language `describe`/`it` strings.
- Preserve existing Chinese user-facing strings and comments unless the surrounding file is clearly English-only.

## Control Flow And Code Shape

- Prefer guard clauses and early returns.
- Avoid deep nesting when a quick validity check can exit early.
- Keep most logic in plain functions.
- Avoid introducing classes unless extending the existing `StateStore` pattern or another clearly class-based area.
- Prefer direct, readable code over clever abstractions.
- Add comments sparingly, mainly for non-obvious geometry, cache, or coordinate logic.

## Error Handling Conventions

- In the browser app, recoverable user-facing failures are often handled with `alert(...)`, `setStatus(...)`, `console.error(...)`, or a boolean/null return.
- In `src/import/index.ts`, parser failures often throw `Error` after validating file contents.
- In route manipulation helpers, invalid operations usually return `null` or `false` instead of throwing.
- In the Worker, return explicit `Response` objects with status codes instead of throwing through the fetch handler.

## Domain Invariants You Must Preserve

- App point objects use `{ lat, lon }`.
- Leaflet objects may use `lng`; convert carefully at boundaries.
- GeoJSON coordinates must remain `[lon, lat]`.
- `Route.geometryType` is `'polyline'` or `'polygon'`.
- For polygons, `route.points` is the outer ring, `route.holes` stores inner rings, and `ringIndex > 0` maps to `route.holes[ringIndex - 1]`.
- `ringIndex === 0` means the outer ring.
- `_display`, `_distCache`, `_holeDistCaches`, and `heatLayer` are runtime/cache fields, not clean persisted model fields.
- If route geometry changes, update or invalidate related caches and refresh display geometry when needed.
- If route selection or geometry changes, refresh the affected UI panels/lists when the current module is responsible for it.
- Keep polygon minimum-vertex rules intact when deleting or simplifying rings.

## State And UI Conventions

- `store` is a mutable singleton shared across modules.
- Many modules import `store` directly instead of using dependency injection; preserve that pattern unless a task explicitly asks for refactoring.
- UI initialization is side-effect driven from `src/main.ts`.
- Lazy `import(...)` is used for some UI-triggered actions; preserve it where intentional.
- When touching DOM-heavy code, prefer the existing pattern of `getElementById`, null checks, and event listeners.
- In Vue files, use `<script setup lang="ts">` and PascalCase component imports.

## Testing Conventions

- Tests are colocated with source as `*.test.ts` under `src/`.
- DOM-heavy tests declare `@vitest-environment jsdom` in a file header comment.
- Use `vi.mock(...)` to isolate Leaflet or module dependencies when necessary.
- Reset shared singleton state in `beforeEach` when tests mutate `store`.
- Prefer focused unit tests around geometry, import/export, and UI command behavior.

## Environment And Secrets

- Worker runtime expects `TIANDITU_API_KEY`.
- Local Worker development uses `.dev.vars`.
- Do not hardcode secrets into source files or commit real keys from local env files.

## Files Agents Should Usually Avoid Editing

- `dist/`, `dist-worker/`, `node_modules/`, and generated assets unless the task is specifically about build output

## Practical Default Workflow

- Read the relevant module and its colocated tests first.
- Make the smallest correct change, then run the narrowest relevant test file.
- Run `npm run build` for TypeScript validation.
- Report lint status honestly, including the current parser caveat if unchanged.
