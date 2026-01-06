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
