# SnapSort - Drag and Drop System

A single `Container`/`Item` class pair (per framework) whose drag/drop behavior is picked with a `mode` config field (`"euclidean"` | `"progressive"` | `"insertion"` | `"swap"`, default `"euclidean"`) instead of separate per-mode classes.

## Package and entry points

### @snap-engine/snapsort

**Location:** `src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**

- `Container` - The only container class. `new Container(engine, parent, { mode, ... })`.
- `defaultAnimations` - Opt-in standard reorder, drop, and click-move animation preset.
- `Item` - The only item class (including ghosts/markers). Never needs a mode.
- `DragSession` - Owns all per-drag state (pointer, ghost, drop target); lives at `container.dragSession` on the root while a drag is active.
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `CanDropEvent`, `DropPriorityEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`.
- `ContainerCallbacks`, `ContainerConfig`, `SortMode`, `SortStrategy`, `DropTargetStrategy`, `DragLifecycleStrategy`.

### @snap-engine/snapsort/callbacks

**Location:** `src/callbacks.ts`

**Exports:** Pure, framework-neutral drop-policy callbacks: `prioritizePointerContainer`, `prioritizeIntersectingContainer`, `prioritizeNearestContainerEdge`, and `rejectDrop`.

### @snap-engine/snapsort/svelte

**Location:** `src/svelte/`
**Language:** Svelte 5
**Dependencies:** the package root and optional `svelte` peer

**Exports:** `Container.svelte`, `Item.svelte`, `Ghost.svelte`, `Handle.svelte`.

### @snap-engine/snapsort/react

**Location:** `src/react/`
**Language:** React (TSX)
**Dependencies:** the package root plus optional `react`, `react-dom`, and `@snap-engine/asset-base` peers

**Exports:** `Engine`/`SnapSortEngine`, `Container`, `Item`, `Ghost`, `Handle`, `useSnapSortEngine`, deprecated `useSnapSortAwaitMutation`, `ContainerObjectContext`, `ItemObjectContext`.

## File Structure

```
snapsort/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts
    ├── container.ts        # Container class + ContainerConfig
    ├── item.ts             # Item class: tree membership, FLIP animation, dispatchers
    ├── events.ts           # Callback event interfaces + ContainerCallbacks
    ├── mutation.ts         # Mutation/ghost/hover dispatch helpers + Vanilla defaults
    ├── algorithm.ts        # Candidate generation, drop policy, and placement
    ├── callbacks.ts        # Standard drop-policy callbacks
    ├── layout.ts           # Pure flow-layout simulation
    ├── snapshot.ts         # ItemSnapshot / ItemSnapshotMetadata types
    ├── drag/
    │   ├── session.ts
    │   ├── lifecycle.ts
    │   ├── drop-strategy.ts
    │   ├── flow-ghost.ts
    │   ├── insertion-marker.ts
    │   └── swap.ts
    ├── svelte/
    │   ├── index.ts
    │   ├── Container.svelte
    │   ├── Item.svelte
    │   ├── Ghost.svelte
    │   └── Handle.svelte
    └── react/
        ├── index.ts
        ├── Engine.tsx
        ├── Container.tsx
        ├── Item.tsx
        ├── Ghost.tsx
        ├── Handle.tsx
        └── useSnapSortAwaitMutation.ts
```

## Core Architecture

### Two independent axes

Sort mode is really two orthogonal choices, each resolved once per drag from the root container's config:

- **Drop-target resolution** (`DropTargetStrategy`, `drag/drop-strategy.ts`): which algorithm (`determineDropTarget` / `determineProgressiveDropTarget` / `determineInsertionDropTarget` / `determineSwapDropTarget` in `algorithm.ts`) picks the winning candidate.
- **Drag/ghost lifecycle** (`DragLifecycleStrategy`, `drag/lifecycle.ts`): how the ghost is created/moved/removed and whether the dragged item itself is hoisted out of flow. Three implementations: `FlowGhostLifecycle` (full-size spacer, FLIP-animated; euclidean + progressive), `InsertionMarkerLifecycle` (floating absolutely-positioned line; insertion), and `SwapLifecycle` (pointer ghost + pairwise exchange; swap).

`ContainerConfig.mode` picks a built-in pair from `builtinStrategies`;
`ContainerConfig.strategy` overrides with a custom pair. A custom drop-target
resolver owns its full resolution policy, including eligibility and priority.

### DragSession

Created on `dragStart` and stored at `root.dragSession`; holds pointer/offset/start, the live ghost item, `pendingGhostTarget`, the resolved `SortStrategy`, and `status` (`pending → active → dropping → ended`). All per-drag state that used to live as `#private` fields on the dragged item now lives here so drag lifecycle strategies (separate classes) can read/write it without needing access to `Item`'s private fields. `items`/`sources` represent the ordered multi-item drag run; selection is consumer-owned through each item's `selected` property.

### Mutator (`mutation.ts`)

This module centralizes item/ghost mutations, ghost creation, and item-hover
dispatch; it is not the dispatch point for every `ContainerCallbacks` entry.
The drag session/lifecycle strategies dispatch root lifecycle callbacks, the
drop algorithm invokes destination policy, and `Container` publishes visual
geometry invalidation. `fireItemMove` fires `onItemMove` on the destination
container if defined, else falls back to destination `onItemInsert`. The
default callback implementations in this module mutate DOM and are exclusively
the Vanilla/core integration. Framework adapters must not install or inherit
them: Svelte/React state is the single source of truth, structural callbacks
must synchronously update that state, and the framework must render the
resulting item/ghost structure.

### Callbacks (`events.ts`)

- Callback configuration is per-container: callbacks neither inherit from the
  root/parent nor bubble. A shared handler object must be installed explicitly
  on each participating container.
- Root-owned lifecycle/integration callbacks: `onDragStart`, `onDragClone`,
  `onDropTargetChange`, `onDragEnd`, and `onVisualGeometryInvalidated`.
- Direct-container callbacks: moves/inserts fire on the destination; removal
  fires on the item's current owner; swap fires once on the dragged item's
  pre-swap owner; hover fires on the owner of `overItem`; ghost callbacks fire
  on the ghost owner recorded in the event.
- Primitives: `onItemInsert`, `onItemRemove`, `onGhostInsert`, `onGhostRemove`, `createGhost` (was `createItemGhost`; dispatches on `event.kind: "flow" | "marker"`), synchronous `flushMutation`; `awaitMutation` is deprecated.
- Semantic: `onItemMove` (preferred — carries `from`/`to` `DragLocation`s).
- Lifecycle: `onDragStart` (return `false` to veto before ghost or item lifecycle state changes), `onDragEnd`, `onDropTargetChange` (fires only when the prospective container/index actually changes).
- Drop policy: `canDrop` first rejects an ineligible destination, then
  `getDropPriority` can override its configured `dropPriority` for the current
  resolution. Both are consulted once per container, not once per candidate
  slot, and must be cheap. Only candidates tied at the highest priority reach
  the active placement algorithm.
- Integration: `onVisualGeometryInvalidated` — one root-coalesced notification
  when drag, ghost, or FLIP transforms may have changed rendered item geometry.
  Consumers use it to invalidate dependent visuals without SnapSort knowing
  what those visuals are.
- `flushMutation` is an integration boundary, not a session callback. It is
  read from the same receiver as item mutations, ghost insert/remove, and root
  clone/target-change/end callbacks. Drag start, ghost creation, hover, policy,
  and visual invalidation dispatch directly. `awaitMutation` is only the
  deprecated fallback when the receiver has no `flushMutation`.
- `onItemRemove` is not the source half of a normal move. It represents
  programmatic removal from the item's current owner or cleanup of a transient
  flow-copy clone.

### Framework adapter ownership

- Never structurally mutate framework-rendered nodes with `insertBefore`,
  `appendChild`, `remove`, or equivalent DOM APIs.
- Every framework-owned destination that can commit a persistent move supplies
  `onItemMove` (or the lower-level `onItemInsert`); swap mode supplies
  `onItemSwap`. Imperative remove support supplies `onItemRemove`.
- Callbacks update Svelte/React state synchronously. Adapter-provided
  `flushMutation` commits the framework render before SnapSort reads geometry.
- Svelte owns its ghost entries inside `Container`; React consumers own ghost
  state and render `Ghost` as documented. Vanilla core retains DOM callbacks.

## Key Concepts

### Drop policy

Containers that exchange items must belong to the same root tree. Eligibility
within that tree is application-defined: put domain identifiers on item or
container metadata, then inspect `itemMetadata`/`itemsMetadata`, `source`/
`sources`, and destination `containerMetadata` in `canDrop`. Preference is
separate from eligibility: configure `dropPriority` or return a per-drag value
from `getDropPriority` before the active mode ranks candidate positions.

`moveItem` is an authoritative programmatic operation. It bypasses `canDrop`
and priority resolution while still committing through the configured mutation
callbacks.

### Mode is per-tree

Resolved from the root container's config at drag start; nested containers should share one mode. Mixed-mode trees are unsupported.

### Layout direction

- **Column:** Vertical stacking, top-to-bottom reordering.
- **Row:** Horizontal alignment, left-to-right reordering, wraps.

## Dependencies

```
@snap-engine/core
    ↓
@snap-engine/snapsort
    ├── /svelte (optional Svelte peer)
    └── /react  (optional React peers)
```
