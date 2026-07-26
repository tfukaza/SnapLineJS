# SnapLine - Node Graph UI System

## Purpose

Node-based graph UI system for creating visual programming interfaces, node editors, and flow-based applications.

SnapLine is experimental and published as synchronized core, Svelte, and React
packages. Breaking changes are allowed before 1.0 and should replace obsolete
APIs directly rather than adding compatibility shims.

## Packages

### @snap-engine/snapline
**Location:** `core/src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**
- `NodeMirror` - Graph node with connectors (opt-in eight-direction resize)
- `ConnectorMirror` - Input/output connector
- `LineMirror` - Visual connection line
- `GroupNodeMirror` - Resizable box that carries the nodes inside it
- `RectSelectController` - Rectangle selection tool
- `PlacementController` - Headless pointer-follow placement state machine
- `snapline-globals` - Typed accessors for the shared `global.data` registries

### @snap-engine/snapline-svelte
**Location:** `svelte/src/`
**Language:** Svelte 5
**Dependencies:** `@snap-engine/snapline`, `@snap-engine/core`

**Exports:**
- `Node.svelte` - Node component
- `Group.svelte` - Exclusive nested group component
- `Connector.svelte` - Connector component
- `Line.svelte` - Connection line component
- `Select.svelte` - Rectangle selection component
- `Placement.svelte` - Placement controller binding and preview

### @snap-engine/snapline-react
**Location:** `react/src/`
**Language:** React/TypeScript
**Dependencies:** `@snap-engine/snapline`, `@snap-engine/core`

Exports `Engine`, `Node`, `Group`, `Connector`, `Line`, `Select`, and
`Placement`, with forwarded refs to core objects where applicable.

## File Structure

```
snapline/
├── core/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── node.ts          # NodeMirror
│       ├── connector.ts     # ConnectorMirror
│       ├── line.ts          # LineMirror
│       └── select.ts        # RectSelectController
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

### NodeMirror
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

### ConnectorMirror
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

### LineMirror
**Extends:** `ElementObject`
**Purpose:** Visual connection between connectors

**Features:**
- Curved Bézier path
- Automatic path updates
- Start/end world coordinates
- Callback-based rendering

### RectSelectController
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
- `nodeObject?: NodeMirror` (bindable) - Node instance

**Slots:**
- Default: Node content and connectors

### Connector.svelte
**Purpose:** Connector wrapper component

**Props:**
- `name: string` - Connector identifier
- `maxConnectors: number` - Connection limit
- `allowDragOut: boolean` - Allow drag out

**Methods:**
- `object(): ConnectorMirror` - Get underlying connector

### Line.svelte
**Purpose:** Renders connection path

**Props:**
- `line: LineMirror` - Line instance

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

- **Node/group transforms and live width/height** are core-written during a
  gesture. Resize uses `WRITE_1 → READ_2 → WRITE_2`: paint the box, remeasure
  connectors, then re-glue lines. `onSizeChange` is observational and
  `onResizeCommit` is the framework persistence boundary.
- **Initial node geometry** is explicit: after assigning a committed framework
  element, adapters call `remeasureDomGeometry()`. ResizeObserver remains the
  ongoing invalidation path, not the initial-mount handshake.
- **Line, selection, and placement geometry** use
  `bindGeometryWriter(...)`. Adapters mount static structure once; the writer
  mutates retained SVG/DOM/graphics refs without framework state. Custom line
  components must bind a geometry writer and clean it up on unmount.
- **Semantic state stays separate:** line phase/payload/target changes use
  `onStateChange`; geometry never requests a framework render.
- **Adapters must render node/group elements with
  `position: absolute; transform-origin: top left`** (and ideally
  `will-change: transform`) — core no longer seeds base styles.
- Adapter cleanup must detach elements or destroy objects with
  `removeElement: false`; React/Svelte remain the sole structural DOM owners.

### Callback conventions

Domain/lifecycle callbacks live in `EventProxyFactory` dictionaries —
Configuration owns plain callback objects. Node callbacks report drag,
selection, resize, and line-list events; group callbacks report membership
deltas; selection callbacks decide whether rubber-band selection may start;
connector callbacks provide connection policy plus drag/candidate/connect/
disconnect lifecycle events. Events carry component references, metadata, and
explicit origins/reasons so consumers never need teardown heuristics.

SnapLine deliberately does not define port types, graph-document mutations,
palette contents, or node factories. Consumers express those policies through
metadata and predicates such as `canConnect`, `canContain`, and `canStart`.
`PlacementController` similarly computes preview/commit coordinates but leaves
rendering and creation to framework adapters and consumer callbacks.
Raw input/DOM plumbing stays on the `event.*` slots.

### NodeManager (engine-scoped registry)

`core/src/node-manager.ts` is the per-engine registry of live SnapLine nodes
and connectors, lazy-created by `getNodeManager(engine)` the first time any
component registers (constructors register, `destroy()` unregisters — no
adapter wiring). `query.ts` enumeration delegates to it, and it hosts
engine-scoped facilities: the controlled-edges controller today, layout
helpers that walk `nodes` tomorrow. GlobalManager is application-wide, so the
managers live in `SnapLineSharedData.nodeManagers` keyed by engine.

### Controlled edges (EdgeSyncController)

`core/src/edge-sync.ts` + the `EdgeSync` adapter components implement the
controlled-edges contract: the CONSUMER's edge document is the only edge
authority; SnapLine reconciles rendered lines to it (`sync()`, hydrating
missing lines with origin `"hydration"`) and translates gestures into
semantic intents (`onEdgeConnect` for gesture connects, `onEdgeDisconnect`
for gesture and replacement disconnects). Programmatic, hydration, and
teardown changes never forward as intents, and sync never forwards its own
mutations (`#reconciling` guard). Edges exist in exactly two representations —
consumer document and rendered lines; `NodeManager` holds membership only and
the controller stores no edges (`getEdges()` is consulted fresh). Intents fire
synchronously inside the drop dispatch; adapters reconcile in a microtask of
the same task, so accept and reject paths both resolve before the frame
paints WITHOUT any paint-atomic flush contract (the no-flushMutation rule
above still holds). Consumers should write their document synchronously
inside intent handlers; deferred stores degrade to a one-frame pending state,
never an inconsistent one.

### Shared global registries

Everything SnapLine stores on the engine's shared `global.data` bag is declared
in `core/src/snapline-globals.ts` (`SnapLineSharedData`) and accessed through
its typed helpers. Engine core's `input.ts` reads `resizeHandles` duck-typed
(it cannot import snapline) — keep the two shapes in sync.

### Pointer claims (camera blocking)

Gesture owners block the camera (and any other GLOBAL input listener) at the
input-dispatch layer, not through a side-channel flag: call
`engine.input.claimPointer(pointerId)` from the gesture's **pointerDown**
handler (claiming at dragStart is legal, but the camera may already have
panned by the 3px drag-start threshold). While a pointer is claimed:

- global `pointerDown`/`pointerMove`/`dragStart`/`drag` for that pointer are
  not delivered; owner dispatch is unaffected;
- global pinches involving the claimed pointer are suppressed;
- global `mouseWheel` is suppressed while ANY claim is held (no camera
  wheel-pan mid-drag);
- end events (`pointerUp`/`dragEnd`/`pinchEnd`) ALWAYS deliver, so a global
  listener that engaged before a late claim can terminate cleanly.

Claims are anchored to the input layer's per-pointer records and **die with
the gesture** (pointer up/cancel) — there is no release call to pair, and a
destroyed owner cannot strand a claim. The deprecated `allowCameraControl`
boolean remains readable by the camera for third-party writers only.

### Group invariants

- Ordinary nodes use center containment; nested groups require full-bounds
  containment. `canContain` may reject any otherwise eligible node or group.
- Each node has at most one resolved direct parent group. `members` and
  membership callbacks describe that direct relation; `descendants` exposes
  the recursive tree. Consumers may replace innermost-parent selection through
  `setGroupMembershipResolver`.
- Drag carry recursively flattens and deduplicates nested group descendants.
- Equal-size group candidates use stable IDs as a deterministic tie-breaker;
  membership cycles are always rejected.
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
- A new connection to a full finite input evicts the oldest live incoming
  line(s) required to make room. Disconnect callbacks fire before the new
  connect callbacks.

### Camera edge-pan

When an engine exposes an enabled `edgePanController`, connector-line drags and
node/group move drags request edge-panning automatically. The controller feeds
updated world coordinates back into the active drag every frame. Selection and
resize gestures intentionally do not edge-pan.

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
