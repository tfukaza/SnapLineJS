# Core Engine Source Directory

## Overview

The `src/` directory contains the core SnapEngine library - a framework-agnostic interactivity engine for DOM-based applications.

**Package:** `@snap-engine/core`
**Build output:** `dist/`
**Build tool:** Vite with TypeScript

## Directory Structure

```
src/
├── index.ts          # Public API exports
├── engine.ts         # Engine class
├── global.ts         # GlobalManager singleton
├── object.ts         # BaseObject & ElementObject
├── camera.ts         # Camera system
├── input.ts          # Input handling
├── collision.ts      # Collision detection (optional)
├── animation.ts      # Animation system (optional)
├── debug.ts          # Debug renderer (optional)
└── util.ts           # Utilities
```

**Note:** Asset components (Camera control, Background, Node UI, Drag-and-drop) have been moved to `assets/` workspace packages.

## Entry Points

Defined in `vite.config.mjs`:

- **Main:** `index.ts` → `dist/snapengine.mjs`
  - Core exports: Engine, BaseObject, ElementObject, Camera, input types, utilities
- **Animation:** `animation.ts` → `dist/animation.mjs`
  - AnimationObject, SequenceObject
- **Collision:** `collision.ts` → `dist/collision.mjs`
  - CollisionEngine, RectCollider, CircleCollider, etc.
- **Debug:** `debug.ts` → `dist/debug.mjs`
  - DebugRenderer

## Module Overview

### `index.ts`

Public API entry point. All external-facing exports.

**Main exports:**

- `Engine`, `BaseObject`, `ElementObject`, `Camera`
- Input types (dragProp, pointerDownProp, etc.)
- Utilities (getDomProperty, EventProxyFactory)

### `engine.ts`

Engine class - main orchestrator for a container.

**Responsibilities:**

- Manages container DOM and camera
- Holds collision engine and debug renderer
- Processes render stages

### `global.ts`

GlobalManager singleton - central coordinator.

**Responsibilities:**

- 6-stage render pipeline (READ_1, WRITE_1, READ_2, WRITE_2, READ_3, WRITE_3)
- requestAnimationFrame loop
- Engine instance registry
- Global object table
- Shared state

### `object.ts`

Core entity classes.

**BaseObject:**

- Transform properties
- Parent-child hierarchy
- Event subscriptions
- Render stage queueing

**ElementObject:**

- Extends BaseObject
- DOM element management
- DOM property caching
- Transform modes

### `camera.ts`

Camera and coordinate systems.

**Coordinate spaces:**

- Screen (browser viewport)
- Camera (container-relative)
- World (scene coordinates)

**Features:**

- Coordinate conversions
- Pan and zoom
- Transform management

### `input.ts`

Unified input handling.

**InputControl:**

- Container-level events
- Mouse and touch normalization
- Drag gesture detection
- Object DOM ownership lookup
- Native pointer capture for DOM-backed owners
- Drag `handoffTo(...)` for capture/owner transfer and pinch `handoffTo(...)`
  for pinch-recipient transfer while each pointer retains its origin capture
- Targeted leaf-to-root object bubbling followed by global fan-out

**Event types:**

- pointerDown, pointerMove, pointerUp
- mouseWheel
- dragStart, drag, dragEnd
- pinchStart, pinch, pinchEnd

### `collision.ts`

Collision detection system.

**CollisionEngine:**

- Frame-based detection
- State tracking
- Collision callbacks
- Synchronous ordered `queryPoint(...)` against current transforms

**Collider shapes:**

- RectCollider
- CircleCollider
- LineCollider
- PointCollider

### `animation.ts`

Web Animations API wrapper.

**AnimationObject:**

- CSS property animation
- Custom variables
- Easing per keyframe

**SequenceObject:**

- Sequential animation chain

### `debug.ts`

Visual debugging overlay.

**Features:**

- Canvas-based rendering
- Object bounding boxes
- Collider visualization
- Custom debug markers

### `util.ts`

Utility functions for DOM operations and transforms.

## Render Pipeline

6-stage pipeline preventing layout thrashing:

1. **READ_1** - Primary DOM reads
2. **WRITE_1** - Primary DOM writes
3. **READ_2** - Secondary reads
4. **WRITE_2** - Transform updates
5. **READ_3** - Final reads
6. **WRITE_3** - Final writes

**Usage:**

```typescript
object.schedule(callback, { stage: "READ_1" });
object.schedule(callback, { stage: "WRITE_2" });
```

**Stage guards:** writes (`writeDom`, `writeTransform`, `writeTransformRecursive`)
are legal in the three WRITE stages *and* at `IDLE` — the gap between frames,
where pointer handlers run — because a style write only invalidates layout.
Reads (`readDom`, `readDomRecursive`) are frame-only: they force layout, so
reading at `IDLE` thrashes. Calling a write synchronously from an input handler
is therefore supported; calling a recursive read there is not.

## Build Configuration

**Entry points (vite.config.mjs):**

- snapengine (main)
- debug (optional)
- animation (optional)
- collision (optional)

**TypeScript:** Declarations generated to `dist/` via vite-plugin-dts

**Output:** ES modules (.mjs)

## Package Structure

```
dist/
├── snapengine.mjs     # Main bundle
├── snapengine.d.ts    # Type declarations
├── animation.mjs      # Animation module
├── animation.d.ts
├── collision.mjs      # Collision module
├── collision.d.ts
├── debug.mjs          # Debug module
└── debug.d.ts
```

## Import Patterns

**External consumers:**

```typescript
import { Engine, ElementObject } from "@snap-engine/core";
import { AnimationObject } from "@snap-engine/core/animation";
import { RectCollider } from "@snap-engine/core/collision";
import { DebugRenderer } from "@snap-engine/core/debug";
```

**Asset packages:**
Must use package imports, never relative paths:

```typescript
// ✅ Correct
import { Engine } from "@snap-engine/core";

// ❌ Wrong
import { Engine } from "../../../src/index";
```

## Key Principles

- **Framework-agnostic:** Works with vanilla JS, React, Svelte, etc.
- **Built package:** Compiled to dist/, not raw source
- **Stage-based rendering:** Prevents layout thrashing
- **Single render loop:** All engines share one RAF loop
- **Optional features:** Collision, animation, debug are separate imports

## Notes

- This is the only built package in the monorepo
- Asset packages import from this as `@snap-engine/core`
- TypeScript path mappings in asset packages point to `src/` for development
- Published package provides built bundles from `dist/`

For API documentation, see `doc/` directory.
