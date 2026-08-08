# SnapSort - Drag and Drop System

A single `Container`/`Item` class pair (per framework) whose drag/drop behavior is picked with a `mode` config field (`"euclidean"` | `"progressive"` | `"insertion"` | `"swap"`, default `"euclidean"`) instead of separate per-mode classes.

## Package and entry points

### @snap-engine/snapsort
**Location:** `src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**
- `Container` - The only container class. `new Container(engine, parent, { mode, ... })`.
- `Item` - The only item class (including ghosts/markers). Never needs a mode.
- `DragSession` - Owns all per-drag state (pointer, ghost, drop target); lives at `container.dragSession` on the root while a drag is active.
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `CanDropEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`.
- `ContainerCallbacks`, `ContainerConfig`, `SortMode`, `SortStrategy`, `DropTargetStrategy`, `DragLifecycleStrategy`.

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
    ├── mutation.ts         # ContainerCallbacks dispatch + Vanilla defaults
    ├── algorithm.ts        # Drop-target resolution + canDrop filtering
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

`ContainerConfig.mode` picks a built-in pair from `builtinStrategies`; `ContainerConfig.strategy` overrides with a custom pair.

### DragSession
Created on `dragStart` and stored at `root.dragSession`; holds pointer/offset/start, the live ghost item, `pendingGhostTarget`, the resolved `SortStrategy`, and `status` (`pending → active → dropping → ended`). All per-drag state that used to live as `#private` fields on the dragged item now lives here so drag lifecycle strategies (separate classes) can read/write it without needing access to `Item`'s private fields. `items`/`sources` represent the ordered multi-item drag run; selection is consumer-owned through each item's `selected` property.

### Mutator (`mutation.ts`)
Every `ContainerCallbacks` invocation goes through one of the `fire*` functions here (`fireItemInsert`, `fireItemRemove`, `fireItemMove`, `fireGhostInsert`, `fireGhostRemove`, `fireCreateGhost`, `fireAwaitMutation`). `fireItemMove` fires `onItemMove` on the destination container if defined, else falls back to `fireItemInsert`. The default callback implementations in this module mutate DOM and are exclusively the Vanilla/core integration. Framework adapters must not install or inherit them: Svelte/React state is the single source of truth, structural callbacks must synchronously update that state, and the framework must render the resulting item/ghost structure.

### Callbacks (`events.ts`)
- Primitives: `onItemInsert`, `onItemRemove`, `onGhostInsert`, `onGhostRemove`, `createGhost` (was `createItemGhost`; dispatches on `event.kind: "flow" | "marker"`), synchronous `flushMutation`; `awaitMutation` is deprecated.
- Semantic: `onItemMove` (preferred — carries `from`/`to` `DragLocation`s).
- Lifecycle: `onDragStart` (return `false` to veto before any state changes), `onDragEnd`, `onDropTargetChange` (fires only when the prospective container/index actually changes).
- Validation: `canDrop` — consulted once per container per drop-target resolution (not per candidate slot); must be cheap.
- Integration: `onVisualGeometryInvalidated` — one root-coalesced notification
  when drag, ghost, or FLIP transforms may have changed rendered item geometry.
  Consumers use it to invalidate dependent visuals without SnapSort knowing
  what those visuals are.

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

### Grouping
Items can only move between containers sharing the same `groupID`.

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
