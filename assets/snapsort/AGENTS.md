# SnapSort - Drag and Drop System

A single `Container`/`Item` class pair (per framework) whose drag/drop behavior is picked with a `mode` config field (`"euclidean"` | `"progressive"` | `"insertion"` | `"swap"`, default `"euclidean"`) instead of separate per-mode classes.

## Package and entry points

### @snap-engine/snapsort

**Location:** `src/`
**Language:** TypeScript
**Dependencies:** `@snap-engine/core`

**Exports:**

- `Container` - The only container class. `new Container(engine, parent, { itemId, mode, ... })`.
- `defaultAnimations` - Opt-in standard reorder, drop, and programmatic move/removal animation preset.
- `Item` - The only ordinary item class. `new Item(engine, parent, { itemId })`; identity is required and construction-only. Ghosts/markers are created internally.
- `DragSession` - Type-only public view of the per-gesture controller. Callback events and `root.dragSession` expose the same controller object; pointer/direct state lives on its discriminated `input` controller.
- Event types: `ItemInsertEvent`, `ItemRemoveEvent`, `ItemMoveEvent`, `ItemSwapEvent`, `GhostCreateEvent`, `GhostInsertEvent`, `GhostMoveEvent`, `GhostRemoveEvent`, `DragStartEvent`, `DragEndEvent`, `DropTargetChangeEvent`, `DropPriorityEvent`, `VisualGeometryInvalidationEvent`, `DragLocation`.
- `DROP_REJECT_PRIORITY` - the effective `-1` destination rejection value.
- Drag presentation types: `DragVisual` (`"item" | "preview" | "none"`) and `DropEffect` (`"move" | "none"`).
- Ghost/insertion render types: `GhostState`, `InsertionMarkerState`, `InsertionGapSegment`, and `InsertionMarkerNeighbor`.
- Render-state types and helpers: `RenderEntry`, `RenderTree`, `RenderTreeEvent`, `createRenderEntry`, `createRenderEntries`, `createRenderTree`, and `reduceRenderTree`.
- Insertion presentation types and helpers: `InsertionMarkerRectOptions`, `insertionMarkerRect`, `toContainerLocalRect`, and `stockInsertionMarkerRectOptions`.
- Geometry values use core's `@snap-engine/core/geometry` types (`Rect`, `Circle`, `Point`) and helpers; SnapSort declares no rectangle types of its own.
- `createVanillaAdapter` and `CreateVanillaAdapterOptions`.
- `ContainerCallbacks`, `ContainerConfig`, and `SortMode`.

### @snap-engine/snapsort/callbacks

**Location:** `src/callbacks.ts`

**Exports:** Pure, framework-neutral drop-policy callbacks: `prioritizePointerContainer`, `prioritizeIntersectingContainer`, `prioritizeNearestContainerEdge`, `prioritizeTreeDepth`, and `rejectDrop`.

### @snap-engine/snapsort/svelte

**Location:** `src/svelte/`
**Language:** Svelte 5
**Dependencies:** the package root and optional `svelte` peer

**Exports:** `Container.svelte`, `Item.svelte`, `Ghost.svelte`, `Handle.svelte`.

### @snap-engine/snapsort/react

**Location:** `src/react/`
**Language:** React (TSX)
**Dependencies:** the package root plus optional `react`, `react-dom`, and `@snap-engine/asset-base` peers

**Exports:** `Engine`/`SnapSortEngine`, `Container`, `Item`, `Ghost`, `Handle`, `useSnapSortEngine`, `ContainerObjectContext`, `ItemObjectContext`.

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
    ├── event-builders.ts   # Immutable item/ghost event and render-state builders
    ├── mutation.ts         # Mutation, ghost, and hover dispatch helpers
    ├── adapter.ts          # Renderer boundary and Vanilla implementation
    ├── render-state.ts     # Framework-owned nested render-tree reducer
    ├── insertion-geometry.ts # Marker rectangle and world/local projection helpers
    ├── algorithm.ts        # Candidate generation, drop policy, and placement
    ├── callbacks.ts        # Standard drop-policy callbacks
    ├── snapshot.ts         # ItemSnapshot / ItemMetadata types
    ├── drag/
    │   ├── session.ts
    │   ├── session-store.ts
    │   ├── lifecycle.ts
    │   ├── drop-strategy.ts
    │   ├── item-visual.ts
    │   ├── pointer-preview.ts
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
        └── useFlushSnapSortAttachments.ts
```

## Core Architecture

### Three independent axes

Keep these three internal concerns separate:

- **Drop-target resolution** (`DropTargetStrategy`, `drag/drop-strategy.ts`): which algorithm (`determineDropTarget` / `determineProgressiveDropTarget` / `determineInsertionDropTarget` / `determineSwapDropTarget` in `algorithm.ts`) picks the winning candidate.
- **Placement feedback** (`DragLifecycleStrategy`, `drag/lifecycle.ts`): how target ghosts, insertion markers, or swap hover state describe the prospective result.
- **Pointer representation** (`DragSession.dragVisual`, `drag/item-visual.ts`, `drag/pointer-preview.ts`): whether the actual item, one root-owned pointer preview, or no visual follows the pointer. Built-in defaults are item for euclidean/progressive, none for insertion, and preview for swap. Consumers can choose another value in `onDragStart`.

`ContainerConfig.mode` picks a built-in pair from `builtinStrategies`. The
strategy interfaces remain internal implementation details; the supported
public configuration surface is the built-in `SortMode` union.

### DragSession

`DragSessionController` is created on `dragStart` and kept in the internal
root-keyed session store. It owns the shared transaction, ghosts, targets,
resolved strategy, visual coordinates, and animation bookkeeping. Its
`input` is either a `PointerDragController` or `DirectDragController`, which
owns input-specific state and commands. Public callbacks and
`root.dragSession` receive the same controller object through the narrower
`DragSession` type; nested containers report `null`.

Direct movement retains one destination rectangle per dragged participant and
animates the active visual from its current rectangle to those projected
rectangles with the destination Container's `animation.reorder` channel.
Position, width, and height share one progress value. A queued drop waits for
that transition; cancel and teardown stop it.

The public type exposes read-only root, participant, source, status, and input
state plus the phase-checked `dragVisual` and `dropEffect` controls. Its arrays,
locations, and coordinate objects are immutable. `DragSession` remains a
type-only root export and cannot be constructed by consumers.

### Mutator (`mutation.ts`)

This module centralizes item/ghost mutations and item-hover dispatch; it is not
the dispatch point for every `ContainerCallbacks` entry.
The drag session/lifecycle strategies dispatch root lifecycle callbacks, the
drop algorithm invokes destination policy, and `Container` publishes visual
geometry invalidation. `fireItemMove` fires `onItemMove` on the destination
container if defined, else falls back to destination `onItemInsert`. The
Vanilla callbacks live behind `createVanillaAdapter` in `adapter.ts` and own
its DOM mutations. Framework adapters must not install or inherit them:
Svelte/React state is the single source of truth, structural callbacks must
synchronously update that state, and the framework must render the resulting
item/ghost structure.

### Callbacks (`events.ts`)

- Structural and root-lifecycle callbacks resolve on the independent root and
  structural callbacks fall back to its adapter. Descendants cannot configure
  `STRUCTURAL_CALLBACKS`; event locations identify the semantic containers.
- Root-dispatched structural callbacks: `onItemMove`, `onItemInsert`,
  `onItemRemove`, `onItemSwap`, `onGhostInsert`, `onGhostMove`, and
  `onGhostRemove`. They execute through the root adapter's synchronous
  `commit` boundary.
- Root-owned lifecycle/integration callbacks: `onDragStart`,
  `onDropTargetChange`, `onDragEnd`, and `onVisualGeometryInvalidated`.
- Direct-container callbacks are limited to destination drop policy and the
  hitbox/hover behavior of an Item's direct owner; they do not inherit or
  bubble.
- Semantic: `onItemMove` (preferred — carries `from`/`to` `DragLocation`s).
- Lifecycle: `onDragStart` (return `false` to veto before ghost or item lifecycle state changes), `onDragEnd`, `onDropTargetChange` (fires only when the prospective container/index actually changes).
- Drop policy: `getDropPriority` can override configured `dropPriority` once
  per Container per resolution. Effective `-1` rejects the destination;
  nonnegative values remain eligible, and only candidates tied at the highest
  value reach the active placement algorithm. Other negative and nonfinite
  values are invalid. Depth preference is application policy, not an insertion
  default; consumers may opt into `prioritizeTreeDepth` through
  `getDropPriority`.
- Geometry policy: hover candidates call `getItemHitbox` on the candidate
  item's direct owner. Non-swap placement hover considers a resolved target's
  direct children plus the nested target Container itself; the smaller hitbox
  wins, with a direct child winning an equal-area tie. The root has no self
  candidate. Swap hover/targeting and the public `findHoveredItem` helper
  remain direct-child-only. Insertion targeting does not call renderer presentation
  code; core creates canonical gap and neighbor state, then ghost callbacks
  publish it through the adapter commit. Item metadata remains read-only
  application data.
- Integration: `onVisualGeometryInvalidated` — one root-coalesced notification
  when drag, ghost, or FLIP transforms may have changed rendered item geometry.
  Consumers use it to invalidate dependent visuals without SnapSort knowing
  what those visuals are.
- `SnapSortAdapter.commit` is the renderer integration boundary, not a session
  callback. Structural item and ghost commands use it; drag start, hover,
  policy, geometry, and visual invalidation dispatch directly.
- `onItemRemove` is not the source half of a normal move. It represents
  programmatic removal from the item's current owner. When that owner has a
  `move` animation, it shares only the Container-owned FLIP transaction used by
  `moveItem`: move and removal keep separate mutation workflows, while
  same-owner commits coalesce between one root snapshot and final layout read.
  An Item with a pending animated programmatic mutation rejects another
  move/removal, and any pending programmatic mutation blocks drag start within
  that root until the commit finishes. While a root owns a drag session,
  programmatic move/removal commands in that root are rejected. Independent
  roots remain concurrent. Direct framework-state deletion bypasses this
  command and animation path.
- Different Containers keep independent programmatic FLIP transactions. Each
  transaction snapshots the root, so a later Container's pass may replace
  animations started by an earlier pass in the same frame; mutation commits
  are still preserved in request order within each Container.
- All drag, candidate, and FLIP geometry is world-space (`ElementBox` from
  core, CSS pixels inside a Camera layer). FLIP deltas are therefore written
  directly as `translate` pixels, spacer/marker sizes as CSS pixels, and the
  layout wrap tolerance is scaled by `1 / zoom` (`layoutWrapToleranceFor`) so
  it stays constant on screen. Never mix in `box.screen` except to draw
  viewport overlays.

Copying is an application recipe, not a lifecycle effect. The destination's
ordinary `onItemMove` moves the original stable ID to the destination and, in
the same synchronous framework update, inserts a fresh-ID replacement with the
same application data at each vacated source. Newly mounted replacements have
no pre-mutation FLIP rectangle and must be ignored safely by animation code.

### Framework adapter ownership

- Never structurally mutate framework-rendered nodes with `insertBefore`,
  `appendChild`, `remove`, or equivalent DOM APIs.
- A framework root that can commit a persistent move supplies `onItemMove` (or
  the lower-level `onItemInsert`); swap mode supplies `onItemSwap` and
  imperative remove support supplies `onItemRemove`. Route by event fields,
  not callback receiver identity.
- Callbacks update Svelte/React state synchronously. Adapter-provided `commit`
  publishes the framework render before SnapSort reads geometry.
- Svelte and React consumers may keep one immutable `RenderTree` per root.
  `reduceRenderTree` routes nested Containers by `itemId`, applies item
  moves/swaps/removals and ghost lifecycle events, and deliberately excludes
  `ItemInsertEvent`, which lacks the application value to materialize.
- Ordinary entries with a null `childTree` render `Item`; non-null child trees
  render `Container`; ghost entries render `Ghost`. A nested Container is
  already the sortable Item and is never wrapped in another Item.
- Svelte stores immutable roots with `$state.raw(...)`; React uses ordinary
  component state. Frameworks own direct children and keyed loops. There is no
  adapter-owned ghost collection or hidden renderer outlet. The Vanilla
  adapter owns its structural DOM commands.

### Insertion geometry ownership

- The insertion algorithm owns candidate geometry. It creates zero-thickness
  world-space gap segments between retained items. Eligible gaps do not
  require pointer hover over their destination Item or Container. It does not
  rank a rendered marker or ghost.
- Rank candidates first by absolute main-axis distance from the pointer to the
  gap: pointer Y for a column and pointer X for a row. Cross-axis center
  distance is not part of the primary score.
- Exact main-axis-distance ties compare the virtual dragged item's leading
  cross-axis edge with the leading edges of adjacent frozen item rectangles,
  then preserve stable tree traversal order if that helper cannot decide. The
  virtual rectangle retains the initial pointer-to-item offset. There is no
  implicit deepest-container preference; an application may opt into
  `prioritizeTreeDepth` through `getDropPriority` when it wants explicit
  virtual-X/pointer-Y depth policy. Because the cross axis never enters the
  score, side-by-side destinations (columns of a board) opt into
  `prioritizePointerContainer` so the column under the pointer wins over a
  neighbor whose gap merely lines up on the main axis.
- Wrapped rows and columns use the selected visual line's measured cross-axis
  band. A boundary that wraps uses the next line's leading edge and band;
  append uses the previous line's trailing edge and band.
- `InsertionMarkerState` exposes `gap`, frozen `previous`/`next` neighbors,
  `isCurrentPlacement`, identity, and slot location. A geometry or
  current-placement change at the same container/index is still an
  `onGhostMove`; `onDropTargetChange` remains reserved for location changes.
- Renderer code owns line thickness, color, and along-line insets. Framework
  `Ghost` components accept an `insertionMarker` option object. Vanilla accepts
  the same object through `createVanillaAdapter({ insertionMarker: ... })`.
- `insertionMarkerRect(marker, options)` requires explicit finite,
  non-negative `thickness`, `startInset`, and `endInset` values. It throws when
  the two insets exceed the canonical gap length; never clamp an invalid
  request. `stockInsertionMarkerRectOptions` is a named built-in renderer
  contract (`3/0/0`), not a helper default.
- `insertionMarkerRect` expands around the canonical centerline and delegates
  to `toContainerLocalRect`. The projection helper converts any world-space
  rectangle to coordinates from the destination padding-box outer edge using
  its border and live scroll position, without subtracting padding. Both
  helpers require a mounted destination.
- Presentation insets never feed candidate ranking. Reject any proposal that
  sends a renderer-computed line rectangle back into the drop algorithm.

## Key Concepts

### Stable application identity

Every ordinary Item and Container, including each independent root, receives a
non-empty `itemId` at construction. The property is read-only for the object's
entire lifetime. IDs are unique across one root tree, including nested
containers and live ghosts; independent roots may reuse them. Framework
components require the same prop for owned and adopted objects and reject a
changed or mismatched ID. Replacing an identity requires a keyed remount.

Uniqueness is a committed logical-tree invariant. Enforce it at placement,
reconciliation, RenderTree, FLIP, and active-session boundaries rather than in
the raw constructor: one synchronous framework commit may briefly contain a
retiring object and its same-ID replacement. Retiring `isDeleteRequested`
objects do not participate in the committed-tree check.

RenderTree state belongs to one stable root component. Reducers recognize that
root structurally and route nested Containers by `itemId`; they intentionally
trust that a root callback is paired with its own state. Destroying the root
ends that state lifetime, so callers must discard it and create a fresh tree
before mounting a replacement root.

### Drop policy

Containers that exchange items must belong to the same root tree. Eligibility
within that tree is application-defined: put domain identifiers on item or
container metadata, then inspect `itemMetadata`/`itemsMetadata`, `source`/
`sources`, and destination `containerMetadata` in `getDropPriority`. Return
`DROP_REJECT_PRIORITY` to reject or a nonnegative value to prefer a destination
before the active mode ranks candidate positions.

`moveItem` is an authoritative programmatic operation. It bypasses drop policy
while still committing through the configured mutation callbacks.

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
