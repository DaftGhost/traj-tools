# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Optional local MBTiles development service via `bun run dev:mbtiles`
- Raster and vector MBTiles catalog support, including mixed local source listings in the basemap selector
- Built-in Leaflet VectorGrid fallback styling for local vector MBTiles backed by metadata-derived `vector_layers`

### Changed

- Local MBTiles tile serving now supports server-side decompression before browser rendering
- Project documentation now reflects the Bun-based MBTiles workflow, current command set, and the present Leaflet-only vector MBTiles limits
- Agent guidance now documents the current build, script typecheck, lint, and test realities

### Fixed

- Vector MBTiles are now excluded unless the source metadata declares `format=pbf` and usable `vector_layers`
- Documentation no longer implies unsupported vector features such as custom styles, labels, sprites, POI overlays, or MapLibre integration

### Tests

- `bun run test` currently passes with 247 tests

## [2.1.0] - Previous

See git history for earlier changes.
