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
├── frame-controller.ts # Engine-owned frame callbacks
├── object.ts         # BaseObject & ElementObject
├── camera.ts         # Camera system
├── input.ts          # Input handling
├── collision.ts      # Collision detection (optional)
├── geometry.ts       # Shared geometry types and pure helpers
├── layout.ts         # Layout simulation over measured box trees (optional)
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
- **Geometry:** `geometry.ts` → `dist/geometry.mjs`
  - Point, Size, Rect, Edges, Bounds, BoxModel, ElementBox types
  - Pure rect/box-model helpers (intersection, content box, projection)
- **Layout:** `layout.ts` → `dist/layout.mjs`
  - createLayoutResolutionPlan, LayoutNode, flow and slot (grid) backends
- **Debug:** `debug.ts` → `dist/debug.mjs`
  - DebugRenderer

## Module Overview

### `index.ts`

Public API entry point. All external-facing exports.

**Main exports:**

- `Engine`, `BaseObject`, `ElementObject`, `Camera`, and the `FrameController`
  interface
- Input types (dragProp, pointerDownProp, etc.)
- Utilities (measureElementBox, EventProxyFactory)

### `engine.ts`

Engine class - main orchestrator for a container.

**Responsibilities:**

- Manages container DOM and camera
- Holds collision engine and debug renderer
- Owns one `FrameController` for synchronous frame-start callbacks
- Processes render stages

### `global.ts`

GlobalManager singleton - central coordinator.

**Responsibilities:**

- 6-stage render pipeline (READ_1, WRITE_1, READ_2, WRITE_2, READ_3, WRITE_3)
- Frame-controller processing before each `READ_1` queue snapshot
- requestAnimationFrame loop
- Engine instance registry
- Global object table
- Shared state

### `frame-controller.ts`

Public callback interface and Engine-owned implementation for work that must
share SnapEngine's single animation-frame clock. Consumers obtain it from
`engine.frameController`; they do not construct or replace it.

**FrameController:**

- Runs callbacks synchronously at `IDLE`, before `READ_1` is snapshotted
- Passes through the shared browser animation-frame timestamp
- Uses snapshot iteration; new callbacks begin on the next tick
- Supports explicit unsubscribe and `AbortSignal` cleanup
- Aborts all callbacks before Engine input teardown
- Reports thrown errors and returned thenable rejections without starving later
  callbacks

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

Inside the camera layer one world unit is one CSS pixel, so computed CSS
lengths (margins, padding, borders, inline `width`/`translate`) are already
world-space. Only values read from `getBoundingClientRect()` are screen-space;
`measureElementBox` maps the client rect's origin and size into world space
and keeps the raw client rect as `ElementBox.screen`. A measurement divides by
the camera's current zoom, so camera state and its painted transform must
change in the same commit (CameraControl paints synchronously when a write is
legal and defers programmatic changes requested during a read stage).

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
- Logical capture for untrusted constructed pointer streams only when native
  capture rejects with `NotFoundError`
- Drag `handoffTo(...)` for capture/owner transfer and pinch `handoffTo(...)`
  for pinch-recipient transfer while each pointer retains its origin capture
- Targeted leaf-to-root object bubbling followed by global fan-out

**Event types:**

- keyDown
- pointerDown, pointerMove, pointerUp
- mouseWheel
- dragStart, drag, dragEnd
- pinchStart, pinch, pinchEnd

### `geometry.ts`

The one geometry vocabulary for core and every asset package. Pure: no DOM
reads, no Camera, no imports. Every other core module (and every asset)
describes points, rects, edges, and box models with these types instead of
declaring its own shapes. The collision engine's allocation-free scalar
kernels live here too, so collision and geometry share one implementation.

### `layout.ts`

Simulates CSS layout over a frozen tree of measured boxes (`LayoutNode`)
without reading the DOM: infers gaps, line sizes, and wrap capacity from
measured children, then re-lays them out with nodes excluded and virtual
entries inserted. Two backends: `flow` (flexbox-style accumulation and
wrapping) and `slots` (measured grid tracks, the basis for CSS grid
simulation). Imports only `geometry.ts`. SnapSort's drop prediction is the
main consumer.

### `collision.ts`

Collision detection system. Geometric predicates (`rectsIntersect`,
`pointIntersectsRect`, ...) are imported from `geometry.ts`.

**CollisionEngine:**

- Frame-based detection
- State tracking
- Collision callbacks
- Synchronous ordered `queryPoint(...)` against current transforms

**Collider shapes:**

- RectCollider
- CircleCollider
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

Frame-start controller processing followed by a 6-stage pipeline preventing
layout thrashing:

0. **FrameController** - Synchronous application updates while `IDLE`
1. **READ_1** - Primary DOM reads
2. **WRITE_1** - Primary DOM writes
3. **READ_2** - Secondary reads
4. **WRITE_2** - Transform updates
5. **READ_3** - Final reads
6. **WRITE_3** - Final writes

Frame callbacks are deliberately not awaited. They must perform any
frame-critical mutation synchronously; promise continuations enqueue future
work rather than joining the current frame. Because callbacks run before the
first queue snapshot, tasks they schedule may participate in all six stages of
the current frame.

**Usage:**

```typescript
object.schedule(callback, { stage: "READ_1" });
object.schedule(callback, { stage: "WRITE_2" });
```

**Stage guards:** writes (`writeDom`, `writeTransform`, `writeTransformRecursive`)
are legal in the three WRITE stages _and_ at `IDLE` — the gap between frames,
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
- geometry (optional)
- layout (optional)

**TypeScript:** Declarations generated to `dist/` via vite-plugin-dts

**Output:** ES modules (.mjs)

## Package Structure

The published package ships raw TypeScript: `package.json` `exports` map each
entry (`.`, `./animation`, `./collision`, `./debug`, `./geometry`,
`./layout`) to its `src/*.ts` file, and `"sideEffects": false` lets bundlers
drop unused modules. `npm run build` still produces ES bundles and rolled-up
declarations in `dist/` (one `.mjs` + `.d.ts` per entry), which verifies the
entries build cleanly.

## Import Patterns

**External consumers:**

```typescript
import { Engine, ElementObject } from "@snap-engine/core";
import { AnimationObject } from "@snap-engine/core/animation";
import { RectCollider } from "@snap-engine/core/collision";
import { contentRect, type Rect } from "@snap-engine/core/geometry";
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
- **Raw-source package:** Exports `src/*.ts` directly; `dist/` is a build check
- **Stage-based rendering:** Prevents layout thrashing
- **Single render loop:** All engines share one RAF loop
- **Optional features:** Collision, animation, debug, geometry, and layout are separate imports

## Notes

- This is the only built package in the monorepo
- Asset packages import from this as `@snap-engine/core`
- TypeScript path mappings in asset packages point to `src/` for development
- Published package provides built bundles from `dist/`

For API documentation, see `doc/` directory.
