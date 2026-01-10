# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **single-page web application for editing geographic routes/trajectories**. Users can import CSV files containing latitude/longitude coordinates, visualize them on an interactive map, edit the routes, and export the modified data. The application runs entirely in the browser with no backend required.

## Development Commands

### Running the Application
```bash
# Start a local HTTP server (Python 3)
python -m http.server 8000

# Alternative with Python 2
python -m SimpleHTTPServer 8000

# Or use any static file server
# Then visit: http://localhost:8000
```

**No build process required** - The application uses vanilla JavaScript with CDN-hosted libraries. You can open `index.html` directly in a browser, though a local server is recommended for proper file loading.

### File Modification
- Edit `index.html`, `main.js`, or `style.css` directly
- Changes take effect immediately after browser refresh
- Version tracking is done manually in HTML comments (e.g., `v20251218-5`)

## Technology Stack

### Core Technologies
- **Vanilla JavaScript (ES6+)** - No framework, uses modern JS features (const/let, arrow functions, modules)
- **HTML5** - Single-page application structure
- **CSS3** - Grid layout, modern styling

### External Libraries (CDN-hosted)
- **Leaflet 1.9.4** - Interactive map library (OpenStreetMap, satellite imagery, custom tile layers)
- **PapaParse 5.4.1** - CSV parsing and generation
- **FileSaver 2.0.5** - Client-side file saving

## Architecture & Code Organization

### Application Structure
The application follows a **procedural JavaScript pattern** with global state management:

```javascript
// Global state
const routes = [];                    // Array of route objects
let selectedRouteId = null;           // Currently selected route
let selectedPoint = null;             // Currently selected point for editing
let editHandle = null;                // Single active edit handle (performance optimization)
```

### Key Design Patterns

#### 1. Dual-Layer Geometry System
The application maintains two representations of route geometry:
- **Original Points** (`route.points`) - Full resolution data for editing, export, and precise operations
- **Display Geometry** (`route._display.*`) - Zoom-dependent simplified version for rendering

This separation enables:
- Performance optimization through Douglas-Peucker simplification
- Editable data remains at full resolution
- Display adapts to current zoom level

#### 2. Zoom-Dependent Simplification
The `SIMPLIFY_CONFIG` object defines tolerance values per zoom level:
```javascript
const SIMPLIFY_CONFIG = {
  tolerancePxForZoom(zoom) {
    if (zoom >= 16) return 0;      // Full resolution at high zoom
    if (zoom >= 14) return 1;
    if (zoom >= 12) return 2;
    // ... more aggressive simplification at lower zoom
  },
  minPoints: 2,
};
```

#### 3. Single Active Edit Handle
To prevent performance issues with thousands of draggable points:
- Only one point is draggable at any time (`editHandle`)
- User clicks a point to activate it for dragging
- Other points remain non-interactive until selected

#### 4. Event-Driven Architecture
All UI interactions are handled through event listeners:
- DOM events (`addEventListener`) for UI controls
- Leaflet map events (`map.on()`) for map interactions
- Keyboard shortcuts for efficiency (Esc, Backspace, etc.)

### Core Data Structures

#### Route Object
```javascript
{
  id: string,              // Unique identifier
  name: string,            // Display name (from filename)
  points: [                // Original full-resolution points
    { lat: number, lon: number, ... }
  ],
  _display: {
    simplified: [],        // Simplified points for current zoom
    layer: L.polyline,     // Leaflet layer object
  },
  editable: boolean,       // Whether editing is enabled
  visible: boolean,        // Whether route is shown on map
  selected: boolean,       // Whether currently selected
}
```

### Important Configuration Objects

Located at the top of [main.js](main.js):

- **`SIMPLIFY_CONFIG`** - Controls Douglas-Peucker simplification tolerance per zoom level
- **`SMOOTH_CONFIG`** - Radius in meters for route smoothing (1-100m, default 20m)
- **`MEASURE_CONFIG`** - Measurement tool snap settings (12px threshold)
- **`segmentExport`** - Segment extraction state and configuration

## Core Features

### 1. CSV Import/Export
- **Import**: Multiple CSV files supported, automatic column detection (lat/lon or latitude/longitude)
- **Export**: Exports selected routes as CSV files with original + modified coordinates
- CSV must contain geographic coordinate columns

### 2. Base Map Layers
Four tile layer options:
- Standard (OpenStreetMap)
- Satellite (Esri World Imagery)
- Dark Mode (CartoDB Dark)
- Light Mode (CartoDB Light)

### 3. Route Editing
- **Enable/disable edit mode** per route (prevents accidental modifications)
- **Drag points** to modify route geometry
- **Add nodes** - Only works at end of route (known limitation)
- **Delete nodes** - Removes selected point
- **Reset view** - Fits all routes in viewport

### 4. Measurement Tool
- Multi-point distance measurement
- **Snap-to-line** functionality for measuring along routes
- Real-time preview of next segment
- Can snap to all routes or only selected route
- Keyboard shortcuts: Esc (clear/exit), Backspace (undo last point)

### 5. Route Smoothing
- Adjustable smoothing radius (1-100 meters)
- Applies smoothing when dragging points
- Affects neighboring points within radius
- Real-time preview via slider

### 6. Route Segmentation
- Extract segments between start/end points
- Vertical search radius for finding intersection points
- Exports only the selected segment

### 7. Multi-Route Management
- Route list panel for selecting/managing routes
- Checkbox for export selection
- Click routes on map to select them
- Color-coded routes (cycling through palette)

## Key Files

- **[index.html](index.html)** (115 lines) - Application entry point, UI layout, CDN library imports
- **[main.js](main.js)** (~1,956 lines) - Core application logic, event handlers, geographic algorithms
- **[style.css](style.css)** (177 lines) - Application styling, responsive grid layout
- **[ReadME.md](ReadME.md)** - Chinese language user documentation

## Performance Considerations

### Canvas Rendering
Map is initialized with `preferCanvas: true` for better performance with many routes:
```javascript
const map = L.map('map', {
  preferCanvas: true,  // Canvas instead of SVG for many points
  // ...
});
```

### Simplification Algorithm
- Douglas-Peucker algorithm adapted to zoom level
- Prevents rendering thousands of points when zoomed out
- Original data always preserved at full resolution

### Edit Handle Management
- Only one marker is draggable at a time
- Prevents browser slowdown with 6000+ draggable points
- User clicks to activate a point, then drags

## Important Implementation Details

### Geographic Calculations
- **Distance**: Uses Haversine formula for great-circle distances
- **Smoothing**: Custom algorithm affecting points within radius
- **Snap-to-line**: Finds nearest point on route segment within threshold

### State Management
- Global variables track application state
- UI updates happen immediately after state changes
- Map renders are triggered by state modifications

### UI Language
All user-facing text is in **Chinese**. Comments in code are mixed Chinese/English.

### Version Tracking
Version is tracked in HTML title and CSS cache busting:
```html
<title>航线编辑器 <span>v20251218-5</span></title>
<link rel="stylesheet" href="style.css?v=20251218-5" />
```

## Limitations & Known Issues

- **Add node feature** - Only works when adding to the end of a route
- **Delete node feature** - Functional but limited utility
- **No testing framework** - No automated tests currently implemented
- **No linting/formatting** - Code style is manually maintained

## Development Workflow

### Making Changes
1. Edit source files directly
2. Refresh browser to see changes
3. For map-related changes, test at different zoom levels to verify simplification
4. For smoothing changes, test with various radius values
5. Update version number in HTML and CSS references if deploying

### Testing Geographic Features
- Test with routes of varying lengths (10 points to 6000+ points)
- Test at different zoom levels (4-18)
- Test snap-to-line functionality with multiple routes
- Verify CSV export maintains coordinate precision
- Test with different base map layers

### Debugging Tips
- Browser console shows most errors
- Leaflet debugging: Check `map`, `route._display.layer` objects
- For simplification issues: Check `SIMPLIFY_CONFIG.tolerancePxForZoom()`
- For smoothing issues: Check `SMOOTH_CONFIG.radiusMeters`
- State inspection: `routes`, `selectedRouteId`, `editHandle` globals

## Common Tasks

### Adding a New Base Map Layer
1. Add tile layer definition in `baseLayers` object in [main.js](main.js:11-26)
2. Add `<option>` element to `<select id="map-select">` in [index.html](index.html:27-33)
3. Match option value to object key

### Adjusting Simplification
Modify `SIMPLIFY_CONFIG.tolerancePxForZoom()` function in [main.js](main.js:48-60)

### Changing Smoothing Algorithm
Modify the smoothing logic around point drag operations in [main.js](main.js) - search for "smooth" or `SMOOTH_CONFIG`

### Adding Export Format
Create new export function similar to `exportCsv()` in [main.js]

## Git Management Best Practices

### Commit Message Convention

Follow semantic commit message prefixes:
- `feat:` - New features (e.g., "feat: 添加手动绘制航线功能")
- `fix:` - Bug fixes (e.g., "fix: 修复航线列表抽屉默认状态")
- `chore:` - Maintenance tasks (e.g., "chore: 添加代码质量工具配置")
- `refactor:` - Code restructuring without behavior change
- `docs:` - Documentation updates
- `perf:` - Performance improvements

Example commit messages from recent history:
```
eeabec3 feat: 导出时生成正序和逆序两个文件，文件名包含起点和终点方位
85d74f7 feat: 支持中文列名和度分格式的坐标解析
1916b3d feat: 添加手动绘制航线功能及单节点航线优化
```

### Co-Authorship with Claude Code

When Claude Code contributes significant changes, include co-authorship:
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

This is automatically handled by the [`.claude/settings.json`](.claude/settings.json) configuration (`includeCoAuthoredBy: true`).

### Version Tracking

The application uses manual version tracking in HTML:
- Format: `vYYYYMMDD-N` (e.g., `v20250108-3`)
- Update in two places when making releases:
  1. `<title>` tag in [index.html](index.html:6)
  2. CSS cache busting parameter in [index.html](index.html:11)
  3. Version display in header [index.html](index.html:17)

### Sensitive Configuration

Never commit files with API keys or sensitive data:
- `config.js` - Contains Tianditu API keys (listed in [`.gitignore`](.gitignore))
- Use [`config.example.js`](config.example.js) as template for new developers
- Document required environment variables in README

### Branch Workflow

Recommended Git workflow:
1. Create feature branches from `master`
2. Use descriptive branch names: `feat/add-heatmap`, `fix/export-bug`
3. Ensure all quality checks pass before merging (see [Code Quality Workflow](#code-quality-workflow))
4. Use pull requests for code review when working in teams

## Skills and Automation Tools

### Available Skills

The project integrates Claude Code skills for enhanced productivity:

**UI/UX Design (`ui-ux-pro-max`):**
- 50 design styles (glassmorphism, minimalism, brutalism, etc.)
- 21 color palettes
- 50 font pairings
- 20 chart types
- 8 tech stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind)

Located in [`.claude/skills/ui-ux-pro-max/`](.claude/skills/ui-ux-pro-max/)

Invoke via: `/ui-ux-pro-max` or use when planning UI improvements

### Slash Commands

Use these commands for code quality and development tasks:

- **`/lint`** - Run ESLint and fix code style issues automatically
- **`/format`** - Format code with Prettier according to project standards
- **`/test`** - Run test suite (when tests are implemented)
- **`/refactor`** - Get assistance with code refactoring
- **`/debug`** - Debug errors and issues with guided assistance
- **`/npm-scripts`** - Manage and run NPM scripts efficiently

Command definitions located in [`.claude/commands/`](.claude/commands/)

### When to Use Skills

1. **UI Improvements**: Use `ui-ux-pro-max` skill when:
   - Redesigning components or layouts
   - Adding new visual features
   - Improving accessibility and responsiveness
   - Selecting color schemes or typography

2. **Code Quality**: Use `/lint` and `/format` commands:
   - Before committing changes
   - After editing JavaScript/CSS files
   - When IDE shows formatting inconsistencies

3. **Development Tasks**: Use appropriate commands based on task type
   - Refactoring: `/refactor` for code restructuring guidance
   - Bug fixing: `/debug` for systematic debugging

## Maintainability and Configurability

### Code Quality Workflow

**Before Committing:**
```bash
# 1. Check code style
npm run lint

# 2. Fix auto-fixable issues
npm run lint:fix

# 3. Format code
npm run format

# 4. Verify formatting
npm run format:check
```

**Automated Hooks:**
The [`.claude/settings.json`](.claude/settings.json) configures automated quality checks:
- **Post-write/edit**: Auto-format JS/TS files with Prettier
- **Console.log detection**: Warns if console.log statements in code
- **Wildcard import detection**: Prevents anti-pattern imports
- **Test execution**: Runs related tests after file changes (when tests exist)
- **Stop hooks**: Lint changed files and analyze bundle size before session end

### Configuration Management

**Environment Configuration:**
- [`config.example.js`](config.example.js) - Template with documentation
- `config.js` - Actual configuration (gitignored)
- Contains: Tianditu API keys, default map layer settings

To set up your environment:
1. Copy `config.example.js` to `config.js`
2. Apply for free API key at http://lbs.tianditu.gov.cn/
3. Replace `YOUR_TIANDITU_KEY_HERE` with your actual key

**Code Quality Configuration:**
- [`.eslintrc.json`](.eslintrc.json) - ESLint rules (browser ES2021, single quotes, 2-space indent)
- [`.prettierrc`](.prettierrc) - Prettier formatting (single quote, 80 char width, 2-space tabs)
- [`.eslintignore`](.eslintignore) - Files to exclude from linting

### Adding New Map Layers

To add new base map options:

1. Add tile layer definition in [main.js](main.js:203-270) in `baseLayers` object
2. Add `<option>` element to `<select id="map-select">` in [index.html](index.html:38-54)
3. Match option value to object key
4. If API key required, add to [`config.example.js`](config.example.js)

Example:
```javascript
// In main.js
const baseLayers = {
  customLayer: L.tileLayer('https://example.com/{z}/{x}/{y}.png', {
    attribution: '© Custom Provider',
    maxZoom: 18
  }),
  // ... other layers
};
```

```html
<!-- In index.html -->
<option value="customLayer">Custom Layer</option>
```

### Extending Functionality

**Adding Export Formats:**
Create new export function similar to `exportCsv()` and `exportGeoJson()` in [main.js](main.js)

**Adjusting Simplification:**
Modify `SIMPLIFY_CONFIG.tolerancePxForZoom()` function in [main.js](main.js)

**Changing Smoothing Algorithm:**
Update smoothing logic in [main.js](main.js) - search for "smooth" or `SMOOTH_CONFIG`

### Versioning Strategy

**Manual Versioning:**
- Update version in [index.html](index.html:6) when releasing features
- Format: `vYYYYMMDD-N` where N is the revision count for that day
- Update CSS cache busting parameter to force browser refresh

**Semantic Versioning Considerations:**
- Major version (X.0.0): Breaking changes or major rewrites
- Minor version (0.X.0): New features, backward compatible
- Patch version (0.0.X): Bug fixes, minor improvements

Current manual versioning works well for single-page application without formal releases.
