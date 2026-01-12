# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**航线编辑器 (Route Editor)** - A single-page web application for editing geographic routes/trajectories. Users can import CSV/GeoJSON files containing latitude/longitude coordinates, visualize them on an interactive map, edit routes with smoothing, and export the modified data.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000, opens automatically)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build
npm run preview

# Run tests with Vitest
npm run test

# Run tests with UI
npm run test:ui

# Lint with ESLint
npm run lint

# Format with Prettier
npm run format
```

## Technology Stack

- **TypeScript 5.3** - Primary language with strict mode
- **Vite 5** - Build tool and dev server
- **Leaflet 1.9.4** - Interactive map rendering (CDN-loaded in index.html)
- **PapaParse 5.4** - CSV parsing
- **FileSaver 2.0.5** - Client-side file export
- **Vitest 1.1** - Testing framework

## Architecture

```
src/
├── main.ts                    # Application entry point
├── config/
│   └── constants.ts           # PALETTE, SIMPLIFY_CONFIG, SMOOTH_CONFIG, etc.
├── state/
│   └── store.ts               # StateStore singleton (routes, selection, tools state)
├── map/
│   ├── index.ts               # Map initialization, base layers
│   └── layers.ts              # Tile layer definitions
├── routes/
│   ├── index.ts               # Import/export, route CRUD
│   └── geometry.ts            # Douglas-Peucker simplification, smoothing, display
├── tools/
│   ├── measure.ts             # Distance measurement with snap-to-line
│   ├── segment.ts             # Segment extraction for export
│   ├── heatmap.ts             # Heatmap visualization
│   └── draw.ts                # Manual route drawing
├── utils/
│   ├── geo.ts                 # Haversine distance, bearing calculations
│   ├── helpers.ts             # File naming, utility functions
│   └── markerIcon.ts          # Custom Leaflet marker icons
├── import/                     # File import handlers
├── export/                     # CSV/GeoJSON export
└── ui/
    ├── index.ts                # Panel navigation, keyboard shortcuts
    ├── panels.ts               # Sidebar panel rendering
    └── commands.ts             # Command palette
```

### Key Design Patterns

**Dual-Layer Geometry System**: Routes maintain two representations:
- `route.points` - Full-resolution original data (editing/export)
- `route._display.simplified` - Zoom-dependent simplified points (rendering)

**Single Active Edit Handle**: Only one marker is draggable at a time (`store.editHandle`) to prevent performance issues with 6000+ points.

**StateStore Singleton**: Centralized state management in `src/state/store.ts` containing:
- `routes[]` - All loaded routes
- `selectedRouteId`, `selectedPoint` - Selection state
- `editHandle` - Currently draggable marker
- `measure`, `segmentExport`, `heatmap` - Tool states

### Core Configuration (src/config/constants.ts)

```typescript
SIMPLIFY_CONFIG = {
  tolerancePxForZoom(zoom): number  // Douglas-Peucker tolerance per zoom level
}

SMOOTH_CONFIG = {
  radiusMeters: number  // Smoothing radius in meters (1-10000, default 20)
}

HEATMAP_CONFIG = {
  gradients: { default, fire, cold, grayscale }
}
```

## Core Features

1. **CSV/GeoJSON Import** - Auto-detects lat/lon columns, supports DMS format
2. **Route Editing** - Drag points with smooth radius affecting neighbors within range
3. **Measurement Tool** - Snap-to-line functionality with real-time distance display
4. **Segment Extraction** - Export portions of routes between two points
5. **Heatmap Visualization** - Show route point density with configurable parameters
6. **Multi-Base Maps** - Tianditu (矢量/影像/地形), OSM, Esri Satellite, Carto Dark/Light

## Important Globals

```typescript
store: StateStore  // Global state singleton
L: typeof Leaflet  // Leaflet global (from CDN script)
```

## Geographic Algorithms (src/utils/geo.ts)

- `haversineDistance(p1, p2)` - Great-circle distance in meters
- `douglasPeuckerIndices(points, tolerance)` - Line simplification
- `perpendicularDistance(point, lineStart, lineEnd)` - Point-to-segment distance
- `calculateBearing(p1, p2)` - Azimuth in degrees (0-360)
- `bearingToDirection(bearing)` - Returns "N", "NE", "E", "SE", "S", "SW", "W", "NW"

## Type Definitions

- `Point = { lat: number; lon: number }`
- `Route = { id, name, points[], color, editable, visible, selected, _display, _distCache, heatOptions }`
- `UIState`, `MeasureState`, `SegmentExportState`, `HeatmapState` in store.ts

## UI Language

All user-facing text in **Chinese**. Code comments are mixed Chinese/English.

## Testing

Test files are co-located with implementation:
- `src/utils/geo.test.ts`
- `src/utils/helpers.test.ts`
- `src/config/constants.test.ts`

Run tests with: `npm run test`

## Code Style

- **ESLint** with TypeScript parser, single quotes, 2-space indent
- **Prettier** for formatting
- Strict TypeScript (`noUnusedLocals: false`, `noUnusedParameters: false`)

## Path Alias

Use `@/*` to import from `src/`:
```typescript
import { store } from '@/state/store';
import { haversineDistance } from '@/utils/geo';
```

## Environment Variables

Tianditu API key loaded from `.env` as `VITE_TIANDITU_API_KEY`.

## Commit Message Convention

Use semantic prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `perf:`

Example:
```
feat: 添加热力图可视化功能
fix: 修复测距工具吸附到选中航线的逻辑
chore: 更新 TypeScript 到 5.3
```
