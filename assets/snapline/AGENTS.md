# SnapLine - Node Graph UI System

## Purpose

Node-based graph UI system for creating visual programming interfaces, node editors, and flow-based applications.

SnapLine is experimental. Its core, Svelte, and React workspace packages are
private and are intentionally excluded from npm publish workflows.

## Packages

### @snap-engine/snapline
**Location:** `core/src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**
- `NodeComponent` - Graph node with connectors (opt-in corner resize via `resizable`)
- `ConnectorComponent` - Input/output connector
- `LineComponent` - Visual connection line
- `GroupNodeComponent` - Resizable box that carries the nodes inside it
- `RectSelectComponent` - Rectangle selection tool
- `snapline-globals` - Typed accessors for the shared `global.data` registries

### @snap-engine/snapline-svelte
**Location:** `svelte/src/`
**Language:** Svelte 5
**Dependencies:** `@snap-engine/snapline`, `@snap-engine/core`

**Exports:**
- `Node.svelte` - Node component
- `Connector.svelte` - Connector component
- `Line.svelte` - Connection line component
- `Select.svelte` - Rectangle selection component

## File Structure

```
snapline/
├── core/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── node.ts          # NodeComponent
│       ├── connector.ts     # ConnectorComponent
│       ├── line.ts          # LineComponent
│       └── select.ts        # RectSelectComponent
└── svelte/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── Node.svelte
        ├── Connector.svelte
        ├── Line.svelte
        └── Select.svelte
```

## Core Classes

### NodeComponent
**Extends:** `ElementObject`
**Purpose:** Draggable graph node with input/output connectors

**Features:**
- Multiple connectors
- Property-based data flow
- Parent-child relationships
- Transform hierarchy

**Key Methods:**
- `addConnector(name, connector)` - Register connector
- `setProp(name, value)` - Set output property
- `getProp(name)` - Get property value
- `addSetPropCallback(callback, propName)` - React to property changes

### ConnectorComponent
**Extends:** `BaseObject`
**Purpose:** Connection point on a node

**Configuration:**
- `name: string` - Connector identifier
- `maxConnectors: number` - Connection limit (-1 = unlimited, 0 = output-only)
- `allowDragOut: boolean` - Can drag connections from this

**Features:**
- Input/output mode
- Connection limits
- Drag permissions
- Connection callbacks

### LineComponent
**Extends:** `ElementObject`
**Purpose:** Visual connection between connectors

**Features:**
- Curved Bézier path
- Automatic path updates
- Start/end world coordinates
- Callback-based rendering

### RectSelectComponent
**Extends:** `ElementObject`
**Purpose:** Rectangle selection tool

**Features:**
- Drag to select
- Visual feedback
- Intersection detection

## Svelte Components

### Node.svelte
**Purpose:** Node wrapper component

**Props:**
- `className?: string` - CSS class
- `LineSvelteComponent?: Component` - Custom line component
- `nodeObject?: NodeComponent` (bindable) - Node instance

**Slots:**
- Default: Node content and connectors

### Connector.svelte
**Purpose:** Connector wrapper component

**Props:**
- `name: string` - Connector identifier
- `maxConnectors: number` - Connection limit
- `allowDragOut: boolean` - Allow drag out

**Methods:**
- `object(): ConnectorComponent` - Get underlying connector

### Line.svelte
**Purpose:** Renders connection path

**Props:**
- `line: LineComponent` - Line instance

**Features:**
- SVG path rendering
- Auto-updates on movement
- Customizable styling

### Select.svelte
**Purpose:** Rectangle selection wrapper

**Props:** None

## DOM ownership contract (framework-cooperative rendering)

Mirrors the SnapSort rule: when a framework binding (Svelte/React) is in use,
**structural DOM (adding, moving, removing, or reparenting elements) is
framework-owned.** Core never inserts or removes elements. Core MAY directly
write **transforms, `data-*` attributes, and property tweaks on existing
elements** — frameworks recover fine from property changes.

Concretely:

- **Node width/height** are framework-rendered: core fires
  `nodeCallback.onSizeChange(w, h)` during a resize drag and the adapter binds
  the size as state. Core only updates its collision hitboxes synchronously
  (`setSizeState`). The connector/line re-glue closes itself through the
  ResizeObserver after the framework's DOM write reflows.
- **The rubber-band selection box** is framework-rendered: core fires
  `selectCallback.onRectChange({x, y, width, height, visible})` and the adapter
  draws (and can restyle/replace) the box. Deliberately NO flush handshake —
  the box visual is not paint-atomic.
- **Node drag transforms, `data-selected` attributes, and line SVG transforms**
  stay engine-written (property writes on existing elements).
- **Adapters must render node/group elements with
  `position: absolute; transform-origin: top left`** (and ideally
  `will-change: transform`) — core no longer seeds base styles.
- SnapLine has **no `flushMutation`/`settleMutation` equivalent and must not
  grow one**: unlike SnapSort's FLIP pipeline, none of SnapLine's delegated
  visuals are paint-atomic.

### Callback conventions

Domain/lifecycle callbacks live in `EventProxyFactory` dictionaries —
`nodeCallback` (`onSizeChange`, `onResizeCommit`, `onLinesChanged`),
`groupCallback` (`onMemberEnter`, `onMemberLeave`, `onDragCommit`),
`selectCallback` (`onRectChange`), `connectorCallback` (connect/disconnect).
`setLineListCallback` and `_onResizeCommit` are deprecated shims. Raw input/DOM
plumbing stays on the `event.*` slots.

### Shared global registries

Everything SnapLine stores on the engine's shared `global.data` bag is declared
in `core/src/snapline-globals.ts` (`SnapLineSharedData`) and accessed through
its typed helpers. Engine core's `input.ts` reads `resizeHandles` duck-typed
(it cannot import snapline) — keep the two shapes in sync. Camera-control
suspension uses the owned-token channel API
(`global.suspend("cameraControl", token)` / `resume` / `isSuspended`), not the
deprecated `allowCameraControl` boolean.

### Design limits (v1, by intent)

- Groups never join other groups (nested groups are excluded in
  `computeMembers`).
- Carried group members are moved via transform parenting only — they are never
  added to `global.data.select`, so a group drag does not alter the selection.
- `attachTransformToGroup`/`detachTransformFromGroup` are the public
  transform-only reparent seam used by the group carry.

## Key Concepts

### Property System
- Nodes have named properties
- Connectors map to properties by name
- Connected connectors share data through properties
- Use `setProp()` to send, `addSetPropCallback()` to receive

### Connector Types
- **Input:** `maxConnectors > 0`, `allowDragOut = false`
- **Output:** `maxConnectors = 0 or -1`, `allowDragOut = true`
- **Bidirectional:** Custom combinations

### Connection Rules
- `-1`: Unlimited connections
- `0`: No incoming (output only)
- `N`: Maximum N incoming connections

## Dependencies

```
@snap-engine/core
    ↓
@snap-engine/snapline
    ↓
@snap-engine/snapline-svelte
```

## Notes

- Connectors must be children of Node components
- Line component injected via `LineSvelteComponent` prop
- Data flows through property system
- All input handling automatic via SnapEngine
