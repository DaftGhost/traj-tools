# Refactor Plan - traj-tools

## Initial State Analysis

### Current Architecture

- **Type**: Vite + TypeScript SPA with Leaflet
- **Modules**: map, routes, tools, ui, state, utils, export, import
- **State Pattern**: Singleton `store` in `src/state/store.ts`
- **Key Coupling**: UI and route geometry linked via callback injection (`setUIRefreshFunctions`)

### Problem Areas Identified

| Issue                                          | Files                                 | Severity |
| ---------------------------------------------- | ------------------------------------- | -------- |
| Duplicate `Point` interface                    | `store.ts`, `geo.ts`                  | Medium   |
| Duplicate `setStatus` functions                | `draw.ts`, `heatmap.ts`, `segment.ts` | Low      |
| Duplicate `snapToRoutes` logic                 | `measure.ts`, `segment.ts`            | High     |
| Duplicate `distanceToSegment` logic            | `geometry.ts`, `segment.ts`           | High     |
| Magic numbers (e.g., `12 * metersPerPx`)       | `segment.ts:584`                      | Low      |
| Excessive `as unknown as` type assertions      | `heatmap.ts`                          | Medium   |
| Duplicate `MeasureRef`/`SegmentRef` interfaces | `measure.ts`, `segment.ts`            | Medium   |

## Refactoring Tasks

### Quick Wins

1. **Extract Unified UI Status Module** (`utils/uiStatus.ts`)
   - Consolidate `setStatus`, `updateStatusCoords` from draw.ts, heatmap.ts, segment.ts
   - Risk: Low - pure utility function extraction

2. **Consolidate Point Interface** (`types.ts` or `utils/geo.ts`)
   - Remove duplicate `Point` interface from `geo.ts`, re-export from `store.ts`
   - Risk: Low - type-only change

3. **Extract Snap Utilities Module** (`utils/snap.ts`)
   - Consolidate `snapToRoutes`, `pointToSegmentDistance` from measure.ts and segment.ts
   - Risk: Medium - modifies behavior slightly, requires careful testing

### Structural Refactoring

4. **Create Unified Ref Interfaces** (`types/refs.ts`)
   - Consolidate `MeasureRef`, `SegmentRef` into common `SnapRef` interface
   - Risk: Medium - affects multiple modules

5. **Fix Heatmap Type Safety** (`tools/heatmap.ts`)
   - Reduce `as unknown as` assertions with proper type guards
   - Risk: Low - type-only improvement

6. **Replace Magic Numbers with Constants**
   - Use `MEASURE_CONFIG.snapThresholdPx` instead of hardcoded `12`
   - Risk: Low - mechanical replacement

### Pattern Improvements

7. **Improve Command Registration** (`ui/commands.ts`)
   - Extract command definitions to separate file
   - Risk: Low - refactoring for maintainability

## Dependencies

```
types/refs.ts → utils/snap.ts → tools/measure.ts, tools/segment.ts
utils/uiStatus.ts → tools/draw.ts, tools/heatmap.ts, tools/segment.ts
```

## Validation Checklist

- [ ] All tests pass (`bun run test`)
- [ ] Build succeeds (`bun run build`)
- [ ] Type checking clean (`bunx tsc --noEmit`)
- [ ] No broken imports
- [ ] No orphaned code
- [ ] Linting passes (`bun run lint`)

## De-Para Mapping

| Before                              | After                       | Status  |
| ----------------------------------- | --------------------------- | ------- |
| `utils/geo.ts` Point                | Re-export from `store.ts`   | Pending |
| `draw.ts` setStatus                 | Use `utils/uiStatus.ts`     | Pending |
| `heatmap.ts` setStatus              | Use `utils/uiStatus.ts`     | Pending |
| `segment.ts` setStatus              | Use `utils/uiStatus.ts`     | Pending |
| `measure.ts` snapToRoutes           | Move to `utils/snap.ts`     | Pending |
| `segment.ts` snapToRoutes           | Import from `utils/snap.ts` | Pending |
| `geometry.ts` distanceToSegment     | Move to `utils/geo.ts`      | Pending |
| `segment.ts` pointToSegmentDistance | Import from `utils/geo.ts`  | Pending |

## Execution Order

1. Create `utils/uiStatus.ts` and update callers
2. Consolidate `Point` interface
3. Create `utils/snap.ts` with unified snap logic
4. Create `types/refs.ts` with unified ref interfaces
5. Fix heatmap type safety
6. Replace magic numbers with constants
7. Extract command definitions
8. Final validation
