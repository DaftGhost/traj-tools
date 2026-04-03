# traj-tools

航线编辑器 - Geographic Trajectory Editor

A web-based trajectory/route editing tool built with Leaflet and TypeScript. Import, edit, visualize, and export geographic routes with support for multiple formats.

## Features

- **Route Management**
  - Import from CSV, GeoJSON, and WKT formats
  - Visual route display with color-coded polylines
  - Merge multiple routes into one
  - Toggle visibility per route

- **Route Editing**
  - Click-to-edit mode with smooth drag adjustments
  - Add/remove nodes interactively
  - Douglas-Peucker simplification based on zoom level
  - Smooth radius control for natural-looking edits

- **Visualization Tools**
  - Heatmap visualization (leaflet.heat)
  - Multiple base maps: OpenStreetMap, Esri Satellite, CartoDB (Light/Dark), Tianditu
  - Zoom-dependent route simplification

- **Measurement Tools**
  - Distance measurement with snap-to-route support
  - Segment export between two points on a route

- **Export Options**
  - CSV and GeoJSON formats
  - Forward and reverse direction exports
  - Automatic bearing-based naming (N_S, E_W, etc.)

## Quick Start

### Prerequisites

- Bun 1.3+
- Node.js 18+ (runtime/tooling compatibility for the underlying ecosystem)
- Cloudflare Wrangler (for Worker development)

### Installation

```bash
# Install dependencies
bun install
```

### Development

**Frontend only (Vite):**

```bash
bun run dev
```

Access at http://localhost:3000

**Full dev with Worker proxy:**

```bash
bun run dev:worker
```

Access at http://localhost:8787 (includes Tianditu tile proxy)

### Build

```bash
# Type-check and bundle
bun run build
```

### Testing

```bash
# Run tests once
bun run test

# Watch mode
bun run test:watch

# UI mode
bun run test:ui

# Run one test file
bun run test -- src/routes/geometry.test.ts
```

### Linting & Formatting

```bash
# Lint
bun run lint

# Format
bun run format
```

## Deployment

### Cloudflare Pages/Workers

```bash
# Build and deploy
bun run deploy
```

**Required environment variables:**

- `TIANDITU_API_KEY` - API key for Tianditu map tiles (server-side only)

**Local development:** Set in `.dev.vars`:

```
TIANDITU_API_KEY=your_key_here
```

## Project Structure

```
traj-tools/
├── src/
│   ├── main.ts              # Bootstrap entry point
│   ├── worker.ts             # Cloudflare Worker (Tianditu proxy + SPA)
│   ├── state/
│   │   └── store.ts          # Central state singleton
│   ├── map/
│   │   ├── index.ts          # Map initialization
│   │   └── layers.ts         # Base layer configuration
│   ├── routes/
│   │   ├── index.ts          # Route CRUD, import, merge
│   │   └── geometry.ts       # Editing, simplification, smoothing
│   ├── tools/
│   │   ├── measure.ts        # Distance measurement
│   │   ├── segment.ts        # Segment export
│   │   ├── heatmap.ts        # Heatmap visualization
│   │   └── draw.ts           # Route drawing
│   ├── ui/
│   │   ├── index.ts          # UI initialization, handlers
│   │   ├── commands.ts       # Command palette
│   │   └── panels.ts         # Panel management
│   ├── import/
│   │   └── index.ts          # CSV/GeoJSON/WKT parsing
│   ├── export/
│   │   └── index.ts          # Data export
│   └── utils/                # Shared utilities
├── dist/                     # Built output
├── wrangler.toml            # Cloudflare config
├── vite.config.ts           # Vite config
└── tsconfig.json            # TypeScript config
```

## Technology Stack

| Category | Technology           |
| -------- | -------------------- |
| Frontend | TypeScript 5, Vite 5 |
| Maps     | Leaflet 1.9          |
| Backend  | Cloudflare Workers   |
| Testing  | Vitest 1.1           |
| Linting  | ESLint, Prettier     |

## Architecture

**Dual Runtime:**

- **Browser SPA**: Vite + TypeScript frontend with Leaflet
- **Cloudflare Worker**: Tianditu tile proxy + SPA asset serving

**State Management:**

- Singleton `store` in `src/state/store.ts`
- Callback injection for UI refresh (`setUIRefreshFunctions`)

**Key Patterns:**

- Side-effect driven module initialization
- Zoom-dependent Douglas-Peucker simplification
- Cache-first tile proxy strategy

## Commands Reference

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `bun run dev`        | Vite dev server (frontend only)   |
| `bun run dev:worker` | Wrangler dev (includes API proxy) |
| `bun run build`      | Type-check + bundle               |
| `bun run preview`    | Preview built frontend            |
| `bun run deploy`     | Build + Cloudflare deploy         |
| `bun run test`       | Run tests once                    |
| `bun run lint`       | ESLint check                      |
| `bun run format`     | Prettier format                   |

## License

MIT
