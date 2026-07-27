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
- `attachControlledGraph` - Installs the controlled-graph bridge (LineReconciler)
- `query` - Read-only `GraphQuery` facade over one engine's graph
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
- `ControlledGraph.svelte` - Controlled-graph bridge (canonical line records)

### @snap-engine/snapline-react
**Location:** `react/src/`
**Language:** React/TypeScript
**Dependencies:** `@snap-engine/snapline`, `@snap-engine/core`

Exports `Engine`, `Node`, `Group`, `Connector`, `Line`, `Select`,
`Placement`, and `ControlledGraph`, with forwarded refs to core objects
where applicable.

## File Structure

```
snapline/
├── core/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── node.ts              # NodeMirror
│       ├── connector.ts         # ConnectorMirror + ConnectorRules
│       ├── line.ts              # LineMirror
│       ├── group.ts             # GroupNodeMirror
│       ├── select.ts            # RectSelectController
│       ├── placement.ts         # PlacementController
│       ├── graph-mirror.ts      # GraphMirror (per-engine registry + scheduler)
│       ├── line-reconciler.ts   # LineReconciler + LineRecord/LineChangeRequest
│       ├── query.ts             # query() GraphQuery facade
│       ├── geometry.ts          # GeometryWriter type
│       └── snapline-globals.ts  # global.data accessors + attachControlledGraph
├── svelte/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── Node.svelte
│       ├── Group.svelte
│       ├── Connector.svelte
│       ├── Line.svelte
│       ├── Select.svelte
│       ├── Placement.svelte
│       └── ControlledGraph.svelte
└── react/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── Engine.tsx
        ├── Node.tsx
        ├── Group.tsx
        ├── Connector.tsx
        ├── Line.tsx
        ├── Select.tsx
        ├── Placement.tsx
        └── ControlledGraph.tsx
```

## Core Classes

### NodeMirror
**Extends:** `ElementObject`
**Purpose:** Draggable graph node with input/output connectors

**Features:**
- Multiple connectors
- Stable domain identity (`nodeId` via `config.id`, minted when omitted)
- Parent-child relationships
- Transform hierarchy

**Key Methods:**
- `addConnectorObject(connector)` - Register connector
- `getConnector(name)` - Look up a connector by name
- `remeasureDomGeometry()` - Re-measure the box and re-glue lines
- `setSize(width, height)` / `setSizeState(width, height)` - Drive size

### ConnectorMirror
**Extends:** `BaseObject`
**Purpose:** Connection point on a node

**Configuration:**
- `id?: string` - Stable graph-global `connectorId` (minted when omitted)
- `name: string` - Construction-time key in the parent node's map
- `rules?: Partial<ConnectorRules>` - Connection policy (see Connection Rules)

**Features:**
- Derived source/target roles (`isSource` = `maxOutgoing !== 0`, `isTarget` = `maxIncoming !== 0`)
- Connection limits and admission predicates
- Surface strategies for headless hit testing and anchors
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
- `id?: string` - Stable graph-global connector identity
- `name: string` - Connector identifier
- `rules?: Partial<ConnectorRules>` - Connection policy

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
  connectors, then re-glue lines. `onSizeChange` is the live observation and
  the batched `onGeometryChanged({ nodes })` reports settled geometry the
  framework may persist (geometry is SnapLine-owned; ignoring the event
  never reverts the mirror).
- **Position and size are one commit.** `#writeSizeGeometry` paints
  `style.width`/`style.height` and the transform subtree in a single WRITE_1
  task, from the values authored in a single tick — never re-read from state a
  later measurement may have moved. Two consequences bind every contributor:
  a DOM→state reconcile must not adopt the measured box while a gesture owns
  the authored one (the rendered box is a frame behind, and pairing it with a
  fresh transform makes the anchored edge jump), and **an adapter must not
  write size through the framework renderer while scheduling the transform
  through the engine** — two schedulers with no ordering contract land them in
  different frames. Prop-driven adapter geometry therefore sets
  `worldTransform` + `setSizeState(...)` and calls `scheduleGeometryWrite()`,
  which routes both through that same single task.
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
metadata and predicates such as `isValidConnection`, `canContain`, and
`canStart`.
`PlacementController` similarly computes preview/commit coordinates but leaves
rendering and creation to framework adapters and consumer callbacks.
Raw input/DOM plumbing stays on the `event.*` slots.

### GraphMirror (engine-scoped registry)

`core/src/graph-mirror.ts` is the per-engine registry of every live SnapLine
mirror, lazy-created by `getGraphMirror(engine)` the first time any mirror
registers (constructors register, `destroy()` unregisters — no adapter
wiring). It holds the node/connector sets, the settled-line and preview-line
sets, and the domain-id indexes (`nodesById`/`connectorsById`/`linesById`,
first-registration-wins with `"duplicate-id"` diagnostics), plus the
engine-scoped interaction state (`selection`, `groups`, `resizingNode`,
`parentGroups`, `membershipResolver`), the installed reconciler slot, and
the coalescing batch-aware reconciliation scheduler
(`scheduleReconciliation`/`flush`/`beginBatch`/`runBatch`). GlobalManager is
application-wide, so the registries live in the
`SnapLineSharedData.graphMirrors` WeakMap keyed by engine. `query(engine)`
is the public read-only facade over it: snapshot lists, `node(id)` /
`connector(id)` / `line(id)` lookups, and `diagnostics()` — never registry
sets or mutation methods; `query.ts` enumeration helpers delegate to the
same registry.

### Controlled lines (ControlledGraph / LineReconciler)

Topology is ALWAYS controlled: the CONSUMER's document is the only line
authority, and there is no imperative public topology API (`deleteLine`,
`createLine`, etc. are `@internal`; a gesture on an engine with no attached
graph owner warns and discards the preview). `core/src/line-reconciler.ts`
plus the `ControlledGraph` adapter components implement the contract:
`attachControlledGraph(engine, { onLineChangeRequest, onDiagnosticsChanged? })`
installs the `LineReconciler` and returns
`{ setCanonicalGraph, flush, dispose }`. The app PUSHES its canonical
`{ lines: LineRecord[] }` snapshot (stable ids); internal triggers
(connector register/unregister, batch close) replay the cached snapshot
through the mirror's coalescing scheduler. Each reconcile pass prunes
mirrors whose record is gone (or whose `fromConnectorId` moved), preserves
and retargets by stable `lineId`, settles or discards staged gesture lines,
and creates settled mirrors for fully-mounted records — strict admission,
never evicting: capacity/rule violations become derived diagnostics and
unmounted endpoints stay silently latent. A gesture drop validates (rules +
both endpoints' `isValidConnection` with the real `LineMirror`), stages the
outcome on the same mirror (phase `"staged"`, no topology commitment), and
dispatches ONE atomic `LineChangeRequest`
(`{ intent: connect|disconnect|replace|reconnect, add, remove, update }` —
`replace-oldest` evictions ride the request, never local deletes). Adapters
GUARANTEE a post-request microtask push of the live records ahead of the
decisive pass, so acceptance, normalization, rejection, and
rejection-by-inaction all resolve from the next snapshot — adopting the
proposed `lineId` settles the dragged line in place; rejection needs no code
path. Consumers should write their document synchronously inside the request
handler; deferred stores degrade to a one-frame pending state, never an
inconsistent one.

### Shared global registries

Everything SnapLine stores on the engine's shared `global.data` bag is declared
in `core/src/snapline-globals.ts` (`SnapLineSharedData`) and accessed through
its typed helpers. It now holds only `resizeHandles` and `sourceSurfaces`
(engine core's `input.ts` reads both duck-typed — it cannot import snapline —
so keep the shapes in sync) plus the `graphMirrors` WeakMap keying each
engine to its `GraphMirror`. Selection, groups, and `resizingNode` are
engine-scoped state on `GraphMirror`, not global arrays.

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
  added to the engine's `GraphMirror.selection`, so a group drag does not
  alter the selection.
- `attachTransformToGroup`/`detachTransformFromGroup` are the public
  transform-only reparent seam used by the group carry.

## Key Concepts

### Connector Types

Roles are derived from `ConnectorRules` limits — there are no role booleans:

- **Target-only (input):** `{ maxOutgoing: 0 }`
- **Source-only (output):** `{ maxIncoming: 0 }`
- **Bidirectional:** both limits non-zero (`isSource` = `maxOutgoing !== 0`,
  `isTarget` = `maxIncoming !== 0`)

### Connection Rules

`ConnectorConfig.rules` (all optional; limits are `number | "unlimited"`,
normalized to `Infinity` internally):

- `maxOutgoing` (default `"unlimited"`) - outgoing limit; previews reserve a slot
- `maxIncoming` (default `1`) - settled incoming limit
- `reconnect` (default `true`) - existing incoming lines can be picked up
- `allowParallel` (default `false`) - BOTH endpoints must allow parallel lines
- `onFull` (default `"reject"`) - a full target rejects, or `"replace-oldest"`
  proposes evicting the oldest incoming lines INSIDE the gesture's atomic
  `"replace"` request (never a local delete)
- `isValidConnection(proposal)` - line-aware admission predicate
  (`{ line, source, target, phase }`); synchronous and side-effect free
  (candidate discovery calls it per pointer move, rechecked on drop and on
  record admission); either endpoint may veto

Canonical-record admission is strict: capacity never evicts regardless of
`onFull`; a refused record stays in the document and surfaces as a
diagnostic.

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
- Dataflow belongs to the application graph: derive values from the same
  records that drive `ControlledGraph` and render through framework state
- All input handling automatic via SnapEngine
