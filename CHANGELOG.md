# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `src/utils/uiStatus.ts` - Unified UI status utilities for `setStatus` and `updateStatusCoords`
- `src/utils/snap.ts` - Consolidated snap utilities (`snapToRoutes`, `pointToSegmentDistance`, `sqSegDist`, `distanceMeters`)
- `src/types/refs.ts` - Unified `SnapRef` interface for route snapping
- `src/types/heatLayer.ts` - Type-safe heat layer utilities with guards
- `src/ui/commandDefinitions.ts` - Command definitions extracted for maintainability
- Test coverage for new utility modules (56 new tests)

### Changed
- Refactored duplicate code from `tools/draw.ts`, `tools/heatmap.ts`, `tools/segment.ts` into `utils/uiStatus.ts`
- Refactored duplicate `snapToRoutes` from `measure.ts` and `segment.ts` into `utils/snap.ts`
- Consolidated `Point` interface to single source in `state/store.ts`
- `tools/measure.ts` now uses unified snap utilities
- `tools/segment.ts` now uses unified snap utilities

### Fixed
- Heatmap type safety improved with proper type guards instead of `as unknown as` casts

### Code Quality
- Added error handling (.catch) to all dynamic imports in command definitions
- Added comprehensive `isHeatLayer()` type guard checking both methods
- Added `HeatLatLng` type with optional intensity for leaflet.heat compatibility
- Added Leaflet type import to heatLayer.ts
- Fixed misleading comments in snap.test.ts (projection coordinates)
- Fixed test assertions to properly check preconditions instead of silent pass

### Tests
- Added `src/utils/uiStatus.test.ts` (12 tests)
- Added `src/utils/snap.test.ts` (17 tests)
- Added `src/types/heatLayer.test.ts` (15 tests)
- Added `src/ui/commandDefinitions.test.ts` (12 tests)
- Total test count: 81 passing tests

## [2.1.0] - Previous

See git history for earlier changes.
