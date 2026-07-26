# SnapEngine Asset Base

## Purpose

Common foundational components used across all SnapEngine products. Essential building blocks for creating interactive applications.

## Packages

### @snap-engine/asset-base
**Location:** `core/src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**
- `CameraControl` - Camera pan/zoom control class
- `CameraControlConfig` - Configuration type
- `Background` - Infinite scrolling background grid

### @snap-engine/asset-base-svelte
**Location:** `svelte/src/`
**Language:** Svelte 5
**Dependencies:** `@snap-engine/asset-base`, `@snap-engine/core`

**Exports:**
- `Engine.svelte` - Main engine wrapper component
- `Camera.svelte` - Camera control component
- `Background.svelte` - Background component
- `getEngine()` / `destroyEngine()` - Legacy keyed Engine instance utilities

### @snap-engine/asset-base-react
**Location:** `react/src/`
**Language:** React (TSX)
**Dependencies:** `@snap-engine/asset-base`, `@snap-engine/core`, `react` (peer)

**Exports:**
- `Engine` - Shared React Engine wrapper and context provider
- `Camera` - Camera control wrapper
- `Background` - Infinite grid wrapper
- `useSnapEngine()` - Access the Engine from descendants
- `useCameraControl()` - Access the CameraControl from descendants

## File Structure

```
asset-base/
├── core/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── camera.ts           # CameraControl class
│       └── background.ts       # Background class
├── svelte/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── Engine.svelte       # Engine wrapper (was Canvas)
        ├── Camera.svelte       # Camera wrapper (was CameraControl)
        ├── Background.svelte   # Background wrapper
        └── engineState.svelte.js # Legacy keyed Engine utilities
└── react/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── Engine.tsx
        ├── Camera.tsx
        └── Background.tsx
```

## Core Classes

### CameraControl
**Extends:** `ElementObject`
**Purpose:** Interactive pan/zoom camera control

**Configuration:**
- `zoomLock?: boolean` - Disable zoom
- `panLock?: boolean` - Disable pan
- `edgePan?: CameraEdgePanConfig` - Opt-in programmatic edge panning for drag owners

**Edge-pan API:**
- `startEdgePan(pointerId, position, onFrame)` begins a pointer-owned request
- `updateEdgePan(pointerId, position)` updates the screen-space pointer
- `stopEdgePan(pointerId)` ends it

The controller registers itself on `engine.edgePanController`. Motion is
continuous while the pointer remains in the configured edge zone, and
`onFrame` receives recomputed world coordinates after every camera move so a
drag owner can stay glued to a stationary pointer.

### Background
**Extends:** `ElementObject`
**Purpose:** Infinite scrolling grid background

**Features:**
- Tile-based grid
- Follows camera movement
- Efficient rendering

## Svelte Components

### Engine.svelte
**Purpose:** Main wrapper that creates and manages engine instance

**Props:**
- `id?: string` - DOM ID (defaults to `snap-canvas`)
- `engine?: Engine` (bindable) - Engine instance
- `debug?: boolean` - Enable debug mode

**Features:**
- Creates engine instance
- Sets up collision engine
- Provides context to children
- Manages debug renderer
- Forwards standard div attributes; consumer styles override defaults
- Defaults to `overflow: visible`

### Camera.svelte
**Purpose:** Camera control with pan/zoom

**Props:**
- `zoomLock?: boolean` - Disable zoom
- `panLock?: boolean` - Disable pan
- `cameraControl?: CameraControl` (bindable) - Control instance

**Features:**
- Pan via drag
- Zoom via scroll
- Sets camera on engine

### Background.svelte
**Purpose:** Renders infinite grid background

**Props:** None

**Features:**
- Auto-updates with camera
- Customizable via CSS

## Naming Notes

- **Engine.svelte** was renamed from `Canvas.svelte` for clarity
- **Camera.svelte** was renamed from `CameraControl.svelte` for brevity
- TypeScript class remains `CameraControl` to avoid conflicts with @snap-engine/core's `Camera` class

## React Components

React exports the same `Engine`, `Camera`, and `Background` concepts. Components
accept standard `className` and `style` props and forward refs to their
underlying SnapEngine objects. SnapSort React and SnapLine React reuse this
package's Engine context.

## Typical Usage Pattern

```svelte
<script>
  import { Engine, Camera, Background } from "@snap-engine/asset-base-svelte";
</script>

<Engine id="app">
  <Camera>
    <Background />
    <!-- Your interactive content -->
  </Camera>
</Engine>
```

```tsx
import { Background, Camera, Engine } from "@snap-engine/asset-base-react";

<Engine id="app">
  <Camera>
    <Background />
  </Camera>
</Engine>;
```

## Dependencies

```
@snap-engine/core
    ↓
@snap-engine/asset-base
    ↓
@snap-engine/asset-base-svelte   @snap-engine/asset-base-react
```
